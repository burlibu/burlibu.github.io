// Ardesia engine: the full rules of chess (castling, en passant, promotion,
// check and mate, stalemate, fifty moves, threefold repetition, insufficient
// material), FEN in and out, SAN, PGN, and a small alpha-beta AI. DOM-free:
// node runs perft on it to prove move generation, and the page runs the AI
// in a worker (ai.js) so the board and clocks never stall.
(function (root) {
  const W = "w", B = "b";
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  // 0x88 board: index = row * 16 + file, row 0 is the 8th rank (a8 = 0, h1 = 119).
  // Any index with a 0x88 bit set is off the board, so sliders stop without bounds checks.
  const sqName = (i) => "abcdefgh"[i & 7] + (8 - (i >> 4));
  const sqIndex = (s) => (8 - +s[1]) * 16 + (s.charCodeAt(0) - 97);
  const KNIGHT = [-33, -31, -18, -14, 14, 18, 31, 33];
  const KING = [-17, -16, -15, -1, 1, 15, 16, 17];
  const DIAG = [-17, -15, 15, 17];
  const ORTH = [-16, -1, 1, 16];
  const F = { CAP: 1, EP: 2, KSIDE: 4, QSIDE: 8, BIG: 16 };
  // castling rights as bits; moving from or to one of these squares clears some
  const WK = 1, WQ = 2, BK = 4, BQ = 8;
  const KEEP = { 0: ~BQ, 4: ~(BK | BQ), 7: ~BK, 112: ~WQ, 116: ~(WK | WQ), 119: ~WK };
  const colorOf = (p) => (p < "a" ? W : B);
  const other = (c) => (c === W ? B : W);
  const mv = (from, to, piece, captured, flags, promo) => ({ from, to, piece, captured, flags, promo });

  class Chess {
    constructor(fen = START) {
      this.load(fen);
    }

    // Throws on anything that isn't a legal, playable position.
    load(fen) {
      const parts = String(fen).trim().split(/\s+/);
      if (parts.length < 4 || parts.length > 6) throw new Error("FEN: servono da 4 a 6 campi");
      const board = new Array(128).fill(null);
      const kings = { w: -1, b: -1 };
      let i = 0;
      for (const ch of parts[0]) {
        if (ch === "/") {
          if ((i & 15) !== 8) throw new Error("FEN: traversa con meno di 8 case");
          i += 8;
        } else if (/[1-8]/.test(ch)) i += +ch;
        else if (/[pnbrqk]/i.test(ch)) {
          if (i & 0x88 || i > 119) throw new Error("FEN: traversa con più di 8 case");
          if (/p/i.test(ch) && (i >> 4 === 0 || i >> 4 === 7)) throw new Error("FEN: pedone sulla prima o ultima traversa");
          if (/k/i.test(ch)) {
            if (kings[colorOf(ch)] >= 0) throw new Error("FEN: più di un re");
            kings[colorOf(ch)] = i;
          }
          board[i++] = ch;
        } else throw new Error(`FEN: carattere non valido "${ch}"`);
        if ((i & 15) > 8) throw new Error("FEN: traversa con più di 8 case");
      }
      if (i !== 120) throw new Error("FEN: servono 8 traverse");
      if (kings.w < 0 || kings.b < 0) throw new Error("FEN: manca un re");
      if (!/^[wb]$/.test(parts[1])) throw new Error("FEN: il turno deve essere w o b");
      if (!/^(-|K?Q?k?q?)$/.test(parts[2]) || !parts[2]) throw new Error("FEN: arrocco non valido");
      if (!/^(-|[a-h][36])$/.test(parts[3])) throw new Error("FEN: en passant non valido");
      this.board = board;
      this.kings = kings;
      this.turnColor = parts[1];
      this.castling = 0;
      for (const [ch, bit, k, r, rook] of [["K", WK, 116, 119, "R"], ["Q", WQ, 116, 112, "R"], ["k", BK, 4, 7, "r"], ["q", BQ, 4, 0, "r"]])
        if (parts[2].includes(ch) && board[k] === (rook === "R" ? "K" : "k") && board[r] === rook) this.castling |= bit;
      this.ep = parts[3] === "-" ? -1 : sqIndex(parts[3]);
      this.half = Math.max(0, parseInt(parts[4], 10) || 0);
      this.full = Math.max(1, parseInt(parts[5], 10) || 1);
      if (this._attacked(kings[other(this.turnColor)], this.turnColor)) throw new Error("FEN: il re di chi non muove è sotto scacco");
      this.stack = [];
      this.played = [];
      this.startFen = this.fen();
      this.keys = [this._key()];
    }

    // ---------- move generation ----------
    // Pseudo-legal moves; `caps` keeps only captures and promotions (quiescence search).
    _gen(caps) {
      const out = [], b = this.board, us = this.turnColor, them = other(us);
      for (let s = 0; s < 120; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = b[s];
        if (!p || colorOf(p) !== us) continue;
        const t = p.toLowerCase();
        if (t === "p") {
          const dir = us === W ? -16 : 16, last = us === W ? 0 : 7;
          const one = s + dir;
          if (!b[one]) {
            if (one >> 4 === last) this._promos(out, s, one, p, null, 0);
            else if (!caps) {
              out.push(mv(s, one, p, null, 0));
              if (s >> 4 === (us === W ? 6 : 1) && !b[one + dir]) out.push(mv(s, one + dir, p, null, F.BIG));
            }
          }
          for (const to of [one - 1, one + 1]) {
            if (to & 0x88) continue;
            const q = b[to];
            if (q && colorOf(q) === them) {
              if (to >> 4 === last) this._promos(out, s, to, p, q, F.CAP);
              else out.push(mv(s, to, p, q, F.CAP));
            } else if (to === this.ep) out.push(mv(s, to, p, us === W ? "p" : "P", F.CAP | F.EP));
          }
        } else if (t === "n" || t === "k") {
          for (const d of t === "n" ? KNIGHT : KING) {
            const to = s + d;
            if (to & 0x88) continue;
            const q = b[to];
            if (!q) { if (!caps) out.push(mv(s, to, p, null, 0)); }
            else if (colorOf(q) === them) out.push(mv(s, to, p, q, F.CAP));
          }
          if (t === "k" && !caps) this._castles(out, s, p, us, them);
        } else {
          for (const d of t === "b" ? DIAG : t === "r" ? ORTH : KING) {
            for (let to = s + d; !(to & 0x88); to += d) {
              const q = b[to];
              if (!q) { if (!caps) out.push(mv(s, to, p, null, 0)); continue; }
              if (colorOf(q) === them) out.push(mv(s, to, p, q, F.CAP));
              break;
            }
          }
        }
      }
      return out;
    }

    _promos(out, from, to, p, q, flags) {
      for (const t of "qrbn") out.push(mv(from, to, p, q, flags, p === "P" ? t.toUpperCase() : t));
    }

    _castles(out, s, p, us, them) {
      const b = this.board, home = us === W ? 116 : 4, rook = us === W ? "R" : "r";
      if (s !== home || this._attacked(s, them)) return;
      if (this.castling & (us === W ? WK : BK) && !b[s + 1] && !b[s + 2] && b[s + 3] === rook &&
          !this._attacked(s + 1, them) && !this._attacked(s + 2, them)) out.push(mv(s, s + 2, p, null, F.KSIDE));
      if (this.castling & (us === W ? WQ : BQ) && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === rook &&
          !this._attacked(s - 1, them) && !this._attacked(s - 2, them)) out.push(mv(s, s - 2, p, null, F.QSIDE));
    }

    _attacked(sq, by) {
      const b = this.board;
      // a white pawn attacks up the board, so the pawn hitting sq sits below it
      const pawn = by === W ? "P" : "p";
      for (const d of by === W ? [15, 17] : [-15, -17]) if (!((sq + d) & 0x88) && b[sq + d] === pawn) return true;
      const up = by === W ? (c) => c.toUpperCase() : (c) => c;
      const [n, k, bi, r, q] = ["n", "k", "b", "r", "q"].map(up);
      for (const d of KNIGHT) if (!((sq + d) & 0x88) && b[sq + d] === n) return true;
      for (const d of KING) if (!((sq + d) & 0x88) && b[sq + d] === k) return true;
      for (const [dirs, slider] of [[DIAG, bi], [ORTH, r]]) {
        for (const d of dirs) {
          for (let s = sq + d; !(s & 0x88); s += d) {
            const p = b[s];
            if (!p) continue;
            if (p === slider || p === q) return true;
            break;
          }
        }
      }
      return false;
    }

    _make(m) {
      const b = this.board, us = this.turnColor;
      this.stack.push({ m, castling: this.castling, ep: this.ep, half: this.half, full: this.full });
      b[m.to] = m.promo || m.piece;
      b[m.from] = null;
      if (m.flags & F.EP) b[m.to + (us === W ? 16 : -16)] = null;
      if (m.flags & F.KSIDE) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
      if (m.flags & F.QSIDE) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
      if (m.piece === "K" || m.piece === "k") this.kings[us] = m.to;
      this.castling &= (KEEP[m.from] ?? 15) & (KEEP[m.to] ?? 15);
      this.ep = m.flags & F.BIG ? (m.from + m.to) >> 1 : -1;
      this.half = m.captured || m.piece === "P" || m.piece === "p" ? 0 : this.half + 1;
      if (us === B) this.full++;
      this.turnColor = other(us);
    }

    _unmake() {
      const u = this.stack.pop(), m = u.m, b = this.board;
      const us = (this.turnColor = other(this.turnColor));
      b[m.from] = m.piece;
      b[m.to] = null;
      if (m.flags & F.EP) b[m.to + (us === W ? 16 : -16)] = m.captured;
      else if (m.captured) b[m.to] = m.captured;
      if (m.flags & F.KSIDE) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
      if (m.flags & F.QSIDE) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
      if (m.piece === "K" || m.piece === "k") this.kings[us] = m.from;
      this.castling = u.castling;
      this.ep = u.ep;
      this.half = u.half;
      this.full = u.full;
    }

    _legal(caps) {
      const us = this.turnColor, them = other(us);
      return this._gen(caps).filter((m) => {
        this._make(m);
        const ok = !this._attacked(this.kings[us], them);
        this._unmake();
        return ok;
      });
    }

    // ---------- notation ----------
    _san(m, legal) {
      let s;
      if (m.flags & F.KSIDE) s = "O-O";
      else if (m.flags & F.QSIDE) s = "O-O-O";
      else {
        const t = m.piece.toLowerCase(), to = sqName(m.to);
        if (t === "p") s = (m.captured ? sqName(m.from)[0] + "x" : "") + to + (m.promo ? "=" + m.promo.toUpperCase() : "");
        else {
          const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
          let dis = "";
          if (rivals.length) {
            const f = sqName(m.from);
            if (!rivals.some((o) => (o.from & 7) === (m.from & 7))) dis = f[0];
            else if (!rivals.some((o) => o.from >> 4 === m.from >> 4)) dis = f[1];
            else dis = f;
          }
          s = t.toUpperCase() + dis + (m.captured ? "x" : "") + to;
        }
      }
      this._make(m);
      if (this.inCheck()) s += this._legal().length ? "+" : "#";
      this._unmake();
      return s;
    }

    _public(m, san) {
      return {
        color: colorOf(m.piece),
        from: sqName(m.from),
        to: sqName(m.to),
        piece: m.piece.toLowerCase(),
        captured: m.captured ? m.captured.toLowerCase() : undefined,
        promotion: m.promo ? m.promo.toLowerCase() : undefined,
        castle: m.flags & F.KSIDE ? "k" : m.flags & F.QSIDE ? "q" : undefined,
        enPassant: !!(m.flags & F.EP),
        san,
        lan: sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : ""),
      };
    }

    _placement() {
      let out = "";
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 16 + f];
          if (!p) empty++;
          else { if (empty) out += empty; empty = 0; out += p; }
        }
        if (empty) out += empty;
        if (r < 7) out += "/";
      }
      return out;
    }

    // the en passant square only counts when a pawn could actually take there
    _epField() {
      if (this.ep < 0) return "-";
      const pawn = this.turnColor === W ? "P" : "p", back = this.turnColor === W ? 16 : -16;
      const can = [-1, 1].some((d) => { const s = this.ep + back + d; return !(s & 0x88) && this.board[s] === pawn; });
      return can ? sqName(this.ep) : "-";
    }

    _castleField() {
      const c = this.castling;
      return (c & WK ? "K" : "") + (c & WQ ? "Q" : "") + (c & BK ? "k" : "") + (c & BQ ? "q" : "") || "-";
    }

    _key() {
      return `${this._placement()} ${this.turnColor} ${this._castleField()} ${this._epField()}`;
    }

    // ---------- public API ----------
    fen() {
      return `${this._key()} ${this.half} ${this.full}`;
    }

    turn() {
      return this.turnColor;
    }

    get(square) {
      const p = this.board[sqIndex(square)];
      return p ? { type: p.toLowerCase(), color: colorOf(p) } : null;
    }

    moves() {
      const legal = this._legal();
      return legal.map((m) => this._public(m, this._san(m, legal)));
    }

    // Accepts {from, to, promotion}, a SAN string ("Nf3", "exd8=Q+") or a LAN one ("g1f3").
    move(input) {
      const legal = this._legal();
      let m;
      if (typeof input === "string") {
        const clean = input.trim().replace(/[+#?!]+$/, "").replace(/0/g, "O");
        m = legal.find((o) => this._san(o, legal).replace(/[+#]$/, "") === clean) ||
            legal.find((o) => sqName(o.from) + sqName(o.to) + (o.promo ? o.promo.toLowerCase() : "") === input.trim());
      } else if (input) {
        const from = sqIndex(input.from), to = sqIndex(input.to), promo = (input.promotion || "q").toLowerCase();
        m = legal.find((o) => o.from === from && o.to === to && (!o.promo || o.promo.toLowerCase() === promo));
      }
      if (!m) return null;
      const pub = this._public(m, this._san(m, legal));
      this._make(m);
      this.played.push(pub);
      this.keys.push(this._key());
      return pub;
    }

    undo() {
      if (!this.played.length) return null;
      this._unmake();
      this.keys.pop();
      return this.played.pop();
    }

    history() {
      return this.played.map((m) => m.san);
    }

    inCheck() {
      return this._attacked(this.kings[this.turnColor], other(this.turnColor));
    }

    kingSquare(color) {
      return sqName(this.kings[color]);
    }

    insufficientMaterial() {
      const rest = [];
      for (let s = 0; s < 120; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = this.board[s];
        if (p && p !== "K" && p !== "k") rest.push([p.toLowerCase(), ((s >> 4) + (s & 7)) & 1]);
      }
      if (rest.length === 0) return true;
      if (rest.length === 1 && (rest[0][0] === "n" || rest[0][0] === "b")) return true;
      // only bishops left, all on squares of one colour
      return rest.every(([t]) => t === "b") && rest.every(([, c]) => c === rest[0][1]);
    }

    status() {
      const legal = this._legal();
      const check = this.inCheck();
      const reps = this.keys.filter((k) => k === this.keys[this.keys.length - 1]).length;
      let reason = null;
      if (!legal.length) reason = check ? "checkmate" : "stalemate";
      else if (this.insufficientMaterial()) reason = "insufficient";
      else if (this.half >= 100) reason = "fifty";
      else if (reps >= 3) reason = "threefold";
      const result = !reason ? "*" : reason === "checkmate" ? (this.turnColor === W ? "0-1" : "1-0") : "1/2-1/2";
      return { over: !!reason, reason, result, check };
    }

    pgn(headers = {}) {
      const result = headers.Result || this.status().result;
      const d = new Date();
      const tags = {
        Event: "Partita su Ardesia",
        Site: "burlibu.github.io",
        Date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
        Round: "-",
        White: "Bianco",
        Black: "Nero",
        ...headers,
        Result: result,
      };
      if (this.startFen !== START) Object.assign(tags, { SetUp: "1", FEN: this.startFen });
      const head = Object.entries(tags).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n");
      const start = this.startFen.split(" ");
      let n = +start[5], t = start[1];
      const words = [];
      this.played.forEach((m, i) => {
        if (t === W) words.push(`${n}.`);
        else if (i === 0) words.push(`${n}...`);
        words.push(m.san);
        if (t === B) n++;
        t = other(t);
      });
      words.push(result);
      const lines = [];
      let line = "";
      for (const w of words) {
        if (line && line.length + w.length + 1 > 80) { lines.push(line); line = w; }
        else line = line ? `${line} ${w}` : w;
      }
      lines.push(line);
      return `${head}\n\n${lines.join("\n")}\n`;
    }

    perft(depth) {
      if (depth === 0) return 1;
      let n = 0;
      for (const m of this._legal()) {
        this._make(m);
        n += depth === 1 ? 1 : this.perft(depth - 1);
        this._unmake();
      }
      return n;
    }
  }

  // ---------- AI: negamax alpha-beta with a capture-only quiescence search ----------
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // piece-square tables (Michniewski's simplified evaluation), white's view, a8 first
  const PST = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
        0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
        -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    // the king walks to the centre once the heavy pieces are gone
    e: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30,
        -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
  };
  const MATE = 100000;

  function evaluate(c) {
    let score = 0, heavy = 0;
    const b = c.board;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (p && p !== "K" && p !== "k" && p !== "P" && p !== "p") heavy += VALUE[p.toLowerCase()];
    }
    const endgame = heavy <= 1400;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p) continue;
      const t = p.toLowerCase(), white = p < "a";
      const i = (white ? s >> 4 : 7 - (s >> 4)) * 8 + (s & 7);
      const v = VALUE[t] + PST[t === "k" && endgame ? "e" : t][i];
      score += white ? v : -v;
    }
    return c.turnColor === W ? score : -score;
  }

  const order = (moves) =>
    moves.sort((a, b) => rank(b) - rank(a));
  const rank = (m) =>
    (m.captured ? 10 * VALUE[m.captured.toLowerCase()] - VALUE[m.piece.toLowerCase()] + 1000 : 0) + (m.promo ? 800 : 0);

  function quiesce(c, alpha, beta, depth) {
    const stand = evaluate(c);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (depth > 5) return alpha;
    for (const m of order(c._legal(true))) {
      c._make(m);
      const v = -quiesce(c, -beta, -alpha, depth + 1);
      c._unmake();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function search(c, depth, alpha, beta, ply) {
    if (depth <= 0) return quiesce(c, alpha, beta, 0);
    const moves = c._legal();
    if (!moves.length) return c.inCheck() ? -MATE + ply : 0;
    if (c.half >= 100) return 0;
    for (const m of order(moves)) {
      c._make(m);
      const v = -search(c, depth - 1, -beta, -alpha, ply + 1);
      c._unmake();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  // level 1-3: search depth, with noise that makes the lower levels miss things
  const LEVELS = { 1: { depth: 1, noise: 90 }, 2: { depth: 3, noise: 20 }, 3: { depth: 4, noise: 4 } };

  function bestMove(c, level = 2, rand = Math.random) {
    const { depth, noise } = LEVELS[level] || LEVELS[2];
    const moves = order(c._legal());
    if (!moves.length) return null;
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      c._make(m);
      const v = -search(c, depth - 1, -MATE - 1, -bestScore + noise, 1) + (rand() - 0.5) * 2 * noise;
      c._unmake();
      if (v > bestScore) { bestScore = v; best = m; }
    }
    return { from: sqName(best.from), to: sqName(best.to), promotion: best.promo ? best.promo.toLowerCase() : undefined };
  }

  // small seeded generator, so ?seed=N replays the same AI choices
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const api = { Chess, START, bestMove, evaluate, rng };
  if (typeof module !== "undefined") module.exports = api;
  else root.Ardesia = api;
})(this);
