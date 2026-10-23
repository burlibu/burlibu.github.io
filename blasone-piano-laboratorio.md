# Blasone — piano aggiornamento sperimentale «Laboratorio dell'Araldo»

**Versione di partenza:** 0.0.8 (implementata)  
**Versione proposta:** 0.0.10-lab, indipendente dalla 0.0.9 (*Duello tra Araldi*), che resta pianificata a parte  
**Stato:** ondate 1 e 2 implementate (vedi «Esito dell'implementazione» in fondo); ondate 3 e 4 da fare  
**Fonte:** tutte le idee di `blasone-idee-meccaniche.md`, sezioni 1–29 e «Ispirazioni da altri generi»

## Obiettivo

Portare nel gioco **tutte** le meccaniche del repertorio, ma dentro un **Laboratorio** separato dalle modalità pubbliche. Il Laboratorio è un formato a moduli: ogni meccanica è un interruttore, così si può provare da sola, come chiede il repertorio, e poi in coppia con le altre.

Il repertorio stesso dice di non combinare tutto nella stessa prima prova. Il piano lo rispetta in due modi:

- il motore e l'interfaccia supportano ogni modulo, ma il rilascio procede per **ondate** (vedi sotto);
- le simulazioni e i test umani provano ogni modulo **da solo** prima delle combinazioni, e alcune coppie sono vietate dal validatore finché la loro ondata non è chiusa.

Classico, Crepuscolo, Draft e Prove dell'Araldo non cambiano. Con il Laboratorio spento ogni seed e ogni codice partita dà la stessa partita della 0.0.8.

## Principi (dal repertorio, resi vincolanti)

1. Ogni abilità si spiega in una frase e si verifica sul tabellone o nella cronaca.
2. Ogni condizione dichiara **quando** si controlla: alla posa, dopo la rivelazione simultanea, a fine turno o a fine partita.
3. I dati legati al tempo si salvano sulla carta o nello stato al momento giusto: niente ricostruzioni dal DOM o dalle animazioni.
4. Modificatori con limite scritto nel testo, niente catene di attivazioni. La forza non scende sotto zero.
5. Un modulo spento non estrae nulla dal generatore (`s.rand`): così i codici senza quel modulo restano riproducibili.

---

## Struttura dei moduli

Ogni modulo ha una lettera. Le lettere compaiono nel codice partita (vedi «Codici partita»).

| Lettera | Modulo | Tipo | Idee coperte | Ondata |
|---|---|---|---|---|
| `o` | **Casata delle Ore** | 4 carte | 1, 2, 3, 4, 6, 7 | 1 |
| `c` | **Compagnia dei Colori** | 4 carte | 18, 19, 20 | 1 |
| `g` | **Tre Regni**: famiglie, vantaggio, Scudo | regola + 4 carte | 14, 21, 22, 23, 24, 25 | 1 |
| `q` | **Compagnia della Giostra** | 4 carte | 5, 8, 13, 15 | 2 |
| `p` | **Presidio** | regola | 27 | 2 |
| `b` | **Obiettivo di torneo** | regola | 17 | 2 |
| `m` | **Campi mutevoli** | regola | 16 | 2 |
| `t` | **Grande torneo in due tempi** | modalità | 26 | 3 |
| `x` | **Arena a sei quarti** | modalità | 28 | 3 |
| `i` | **Arcipelago** | modalità | 29 | 3 |
| `n` | **Migrazione** e Rondine (Nomade) | regola + 1 carta | 9, 10 | 4a |
| `r` | **Richiamo** e **Spostamento** | regola | 11, 12 | 4b |

Le «Ispirazioni da altri generi» non sono un modulo a sé: ognuna è già coperta (controllo del territorio → `p`; corsie → `x`; collezionabili → `g`; draft → vedi «Formati»; unità mobili → `n`; obiettivi a rotazione → `b`; push-your-luck → Ariete in `q`).

---

## Ondata 1 — carte e regole leggibili dal tabellone

Tutto si calcola dal tabellone finale, con i dati che il motore già conserva (`at`, l'ordine delle carte nel quarto). Rischio basso, nessun cambio al flusso del turno.

### `o` · Casata delle Ore (tempo e parità)

| Bestia | Forza | Tintura | Abilità | Idea |
|---|---:|---|---|---|
| **Gazza** | 2 | Nero | **Aritmetica:** +2 se la forza stampata è pari. | 1 |
| **Cavalletta** | 2 | Verde | **Salto:** +2 se è stata posata in un turno pari. | 2 |
| **Civetta delle Ore** | 2 | Argento | **Meridiana:** +1 se posata nei turni I–II, +2 nei III–IV, +1 nei V–VI. | 6 |
| **Picchio** | 1 | Rosso | **Ritmo:** +1 se la tua carta precedente nello stesso quarto è stata posata nel turno prima. | 7 |

- La Gazza ha forza 2, quindi la sua abilità è sempre attiva: in pratica vale 4. Tenerla così è voluto: è la «prova aritmetica» del repertorio (sequenza consigliata, punto 1), cioè verifica che l'interfaccia della parità si legga, non un'abilità di scelta. La variante da simulare, «+2 se la forza stampata **della carta avversaria più recente** nel quarto ha parità opposta» (idea 1, *Doppia lettura*), entra al posto della prima se la Gazza risulta piatta.
- Le altre idee della famiglia diventano **varianti di simulazione** di queste quattro carte, provate cambiando solo l'abilità:
  - idea 3 (parità del numero di carte) → variante del Picchio: «+1 se le tue carte nel quarto sono in numero pari»;
  - idea 4 (parità del totale **stampato**, mai di quello modificato) → variante della Gazza;
  - idea 6 *Alba*, *Crepuscolo*, *Scadenza* → varianti della Civetta (la Scadenza, «−1 dal turno dopo la posa», è la sola che fa scendere una carta nel tempo: provarla per ultima).
- Il turno si legge da `at`, scritto da `lay()`. Il Picchio legge l'`at` della carta precedente nell'array del quarto.
- La Civetta usa il glifo del Gufo (🦉): serve un disegno proprio in `art/`, come Grifone e Basilisco.

### `c` · Compagnia dei Colori (tinture)

«Stessa tintura» vuol dire la tintura esatta (oro, argento, rosso, azzurro, verde, nero).

| Bestia | Forza | Tintura | Abilità | Idea |
|---|---:|---|---|---|
| **Cardellino** | 2 | Oro | **Stormo:** +2 per ogni altra tua carta d'oro nel quarto, massimo +4. | 18 |
| **Ermellino** | 2 | Argento | **Campo netto:** +2 se l'avversario non ha carte rosse nel quarto. | 19 |
| **Gambero** | 3 | Rosso | **Specchio:** +2 se l'avversario non ha carte rosse nel quarto. | 19 |
| **Tessitore** | 2 | Verde | **Trama:** +1 a ogni tua carta verde nel quarto (lui compreso), al massimo +2 in tutto per carta da Tessitori. | 18 |

- L'Ermellino sostituisce la «Salamandra pallida» del repertorio, perché il nome si confonde con la Salamandra delle Fiere.
- Il Gambero è rosso, quindi la sua condizione coincide con quella dell'Ermellino ma premia il lato opposto della legge delle tinture (un colore che vuole il quarto senza il suo colore). Se in simulazione le due carte si sovrappongono troppo, il Gambero passa alla variante «+1 per ogni tintura diversa tra le tue carte nel quarto, massimo +3» (idea 19).
- La terza variante dell'idea 19, «−1 alla carta avversaria più forte senza alleati della stessa tintura», resta una variante di simulazione dell'Ermellino.
- Le condizioni si calcolano una volta dal conteggio delle carte, mai dalla loro forza: nessun ciclo.

### `g` · Tre Regni: famiglie, vantaggio e Scudo

**Famiglie.** Ogni bestia riceve una famiglia, in un nuovo campo `fam` del catalogo. Una sola famiglia per carta (idea 21).

| Famiglia | Bestie esistenti | Nuove |
|---|---|---|
| Volante | aquila, gallo, cigno, gufo, pavone | gazza, civetta delle ore, picchio, cardellino, tessitore, cicogna, pappagallo, rondine, albatros, pellicano |
| Marino | delfino, balena, lontra, tartaruga | gambero, squalo |
| Terrestre | leone, cervo, lupo, tasso, orso, cinghiale, volpe, pantera, stambecco | cavalletta, ermellino, lepre, ariete, bufalo |
| Draconico | drago, serpe, salamandra, scorpione, basilisco | — |
| Arcano | unicorno, fenice, grifone, arpia | — |
| Costrutto | torre | — |

La famiglia è un'etichetta stampata sulla carta, nel bestiario e nel filtro del bestiario, **anche con il modulo spento**: è informazione, non regola.

**Vantaggio (idea 22).** Ciclo: Volante prevale su Terrestre, Terrestre su Marino, Marino su Volante. Draconico, Arcano e Costrutto sono fuori dal ciclo.

- Prima versione: **solo vantaggio**, +1 una volta per carta se nel quarto c'è almeno una carta avversaria della famiglia che prevale. È la versione che il repertorio indica come più sicura.
- Variante B, da simulare dopo: vantaggio +1 e vulnerabilità −1.
- Variante C: +1 al **totale** del quarto se la tua famiglia prevale sulla famiglia più numerosa avversaria.
- Si controlla dopo la rivelazione, dal tabellone. Nel dettaglio della forza la voce si chiama «Vantaggio: Volante su Terrestre».

**Carte dei Regni (idee 23 e 25).**

| Bestia | Forza | Tintura | Famiglia | Abilità |
|---|---:|---|---|---|
| **Albatros** | 3 | Argento | Volante | **Picchiata:** +1 se nel quarto c'è una carta Terrestre avversaria. |
| **Squalo** | 4 | Azzurro | Marino | **Fauci:** +1 se nel quarto c'è una carta Volante avversaria. |
| **Bufalo** | 4 | Nero | Terrestre | **Guado:** +1 se nel quarto c'è una carta Marino avversaria. |
| **Pellicano Custode** | 2 | Argento | Volante | **Riparo:** ogni tua carta nel quarto ignora il primo punto di malus da abilità avversaria. Non protegge dai campi. |

- Le tre carte del ciclo si **sommano** al vantaggio generale: un Albatros contro un Terrestre prende +1 dal ciclo e +1 dalla sua abilità. È voluto: sono le carte che rendono il ciclo una scelta da mano. Se i quarti vinti superano il 60%, il primo taglio è togliere il vantaggio generale a queste tre.
- **Scudo (idee 14 e 24).** Il motore marca ogni modificatore con la sua origine: `foe` (abilità avversaria: Serpe, Gufo, Basilisco, Arpia, Ermellino…), `own` (abilità propria, Drago e Scorpione compresi), `field` (campo). Il Pellicano aggiunge, a ogni sua carta alleata con almeno un malus `foe`, una voce +1 «Riparo» e una nota «Serpe −1, annullato dal Pellicano». Non si accumula: due Pellicani nello stesso quarto danno uno Scudo solo. Non annulla malus di campo, di Drago o di Scorpione, né le corone.
- La riserva dell'idea 14, «conservare un bonus fino al turno dopo», è rinviata: richiede uno stato che passa tra i turni, e l'ondata 1 non ne ha.
- **Araldo delle Bestie** (idea 23, forza 0, riduce di uno il vantaggio avversario nel suo quarto) è **di riserva**: entra solo se il vantaggio risulta troppo forte in simulazione, come contromisura. Una carta da 0 che modifica un altro modificatore è difficile da leggere, e serve solo se il problema esiste.

---

## Ondata 2 — stati che passano tra i turni

Qui il motore deve ricordare la storia della partita, non solo il tabellone finale. Ogni nuovo dato si scrive in `play()` dopo la rivelazione, che è l'unico momento in cui cambia il tabellone.

### `q` · Compagnia della Giostra (ordine di posa, scommessa, varietà)

| Bestia | Forza | Tintura | Abilità | Idea |
|---|---:|---|---|---|
| **Cicogna** | 3 | Argento | **Primogenitura:** +2 se è la prima tua carta nel quarto. | 5 |
| **Lepre** | 3 | Rosso | **Ultimo suggello:** +2 se posata nel turno VI in un quarto dove anche l'avversario ha carte. | 5 |
| **Ariete** | 4 | Oro | **Scommessa:** posandolo puoi dichiarare il quarto. Se lo conquisti, +1 corona solo per te; se lo perdi, l'Ariete ha −2. | 13 |
| **Pappagallo** | 2 | Verde | **Varietà:** +1 se nel quarto hai carte di più casate dell'avversario (il Bestiario conta come casata). | 15 |

- **Sentinella** (idea 5, «+1 se posata prima di tutte le carte avversarie del quarto») e le tre varianti d'ingresso dell'idea 8 (quarto vuoto per entrambi, ultima su almeno due avversarie, malus in un quarto già pieno di alleati) sono **varianti di simulazione** della Cicogna. Il Cinghiale e la Volpe coprono già «primo» e «avversario già presente», quindi la variante tenuta deve cambiare il risultato, non duplicarlo.
- **Ariete e Editto.** La Scommessa è legata alla carta, l'Editto al turno. Si possono usare insieme ma non sullo **stesso** quarto nello stesso turno: il validatore di `play()` lo rifiuta. La dichiarazione è un dato salvato sulla carta (`bet: true`), letto in `quarter()`: a quarto perso aggiunge −2 «Scommessa persa», a quarto vinto una voce `extra` «Ariete», come Pavone ed Editto. Il −2 può far perdere il quarto: si calcola come la Fenice, cioè con un secondo passaggio. Se è proprio il −2 a far perdere il quarto, la scommessa resta persa e il −2 resta: nessun ricalcolo ulteriore.
- **Pappagallo.** È la sola carta del Laboratorio che legge le casate. È diverso dalla Rivalità: premia la varietà, non lo scontro tra casate uguali. Limite +1, come chiede l'idea 15.

### `p` · Presidio (idea 27)

- Dopo la rivelazione di ogni turno, `play()` registra chi conduce ogni quarto: `s.hold[q] = { me: n, foe: m }`. Sul Campo rovesciato conduce chi ha il totale più basso, come in `quarter()`. Un quarto conteso in parità non dà segnale a nessuno.
- **Prima versione (soglia):** +1 corona a chi ha condotto il quarto per **almeno 4 turni su 6** (8 su 12 nel Grande torneo). Non serve vincere il quarto alla fine: la corona di Presidio è separata dalla conquista.
- **Seconda versione (segnali), da provare solo dopo:** una corona ogni 3 segnali, massimo 2 per quarto, nessuna in parità di segnali.
- Sullo scudo: sei tacche sotto il nome del quarto, piene nel colore del lato che conduceva. Nel riepilogo, una riga «Presidio» tra le corone del quarto.

### `b` · Obiettivo di torneo (idea 17)

- A inizio partita, se il modulo è attivo, il generatore estrae **un** obiettivo pubblico da un elenco fisso, mostrato prima della prima mossa. Stesso obiettivo per entrambi.
- Elenco iniziale (tutti verificabili a fine turno e salvati in `s.goalPublic`, una volta sola):
  1. Il primo quarto di punta conquistato a fine turno vale +1 corona a chi lo tiene alla fine.
  2. Il primo lato con carte in tutti i quarti riceve +1 corona.
  3. La prima casata presente su entrambi i lati dello stesso quarto dà un Sigillo (+1 corona) a chi vince quel quarto.
- La corona dell'obiettivo è una voce a sé nel riepilogo, distinta da Torre, Pavone, Editto, Rivalità, Presidio e Ariete.
- Non combinare con il Presidio nella prima prova (vedi «Combinazioni vietate»): sono tutti e due «premi per il controllo», e non si capirebbe quale dei due cambia la strategia.

### `m` · Campi mutevoli (idea 16)

- Un campo per partita, estratto a sorte tra quelli che hanno una tintura, cambia regola dal turno IV, sempre verso un campo dello stesso tipo: per esempio Campo d'oro → Campo di rosso.
- Il cambio è **annunciato** dall'inizio: sotto il nome del quarto «Dal turno IV: Campo di rosso».
- `quarter()` legge il campo attivo da `s.turn`: il nuovo campo si applica anche alle carte già posate, come dice il repertorio. Il campo stampato nella cronaca resta quello del momento.
- Per il repertorio è uno scenario: si prova come modulo da solo e poi in una Prova dell'Araldo dedicata. Non entra mai nei campi casuali dei formati pubblici.

---

## Ondata 3 — modalità che cambiano durata e geometria

Il motore oggi assume quattro quarti e sei turni: `QUARTERS`, `ROMAN`, `NEAR`, i controlli `q < 2` e `q >= 2` di Delfino, Gallo e Stambecco, `TURNS`. Prima di questa ondata serve un **refactor senza cambi di comportamento**:

- `s.map = { n, near, top }`: numero di quarti, quarti confinanti, quarti «di capo». Il valore predefinito è quello di oggi (`n: 4`, `NEAR`, `top: [0, 1]`).
- Ogni lettura di `q < 2` diventa `s.map.top.includes(q)`; ogni `NEAR[q]` diventa `s.map.near[q]`; ogni `TURNS` diventa `s.turns`.
- Verifica: con la mappa predefinita, il confronto con il motore 0.0.8 (letto da git a `c485a59`, come già fa `blasone-check.js` con le versioni precedenti) deve dare partite identiche.

### `t` · Grande torneo in due tempi (idea 26)

- Due tempi da sei turni. A fine del primo tempo le corone si **depositano** in `s.banked`; tabellone, controlli di Presidio e bonus si azzerano, si estraggono nuovi campi.
- Mazzi senza doppioni e mai rimescolati. A fine primo tempo ogni lato pesca fino a quattro carte.
- L'Editto vale **uno per partita**. La Scommessa dell'Ariete e l'Obiettivo di torneo valgono per tempo.
- In parità di corone totali: prima la forza totale del secondo tempo, poi quella complessiva, poi pareggio.
- Tra i due tempi un foglio di intervallo mostra le corone depositate e i nuovi campi, prima del turno VII.
- Il Presidio a soglia diventa 8 su 12, contato sull'intera partita per i quarti (gli indici restano gli stessi anche se i campi cambiano).

### `x` · Arena a sei quarti (idea 28)

- Tabellone 2 righe × 3 colonne, quarti I–VI. I quarti centrali hanno tre vicini (sinistra, destra, sotto o sopra), quelli d'angolo due. (Il repertorio parla di «quattro vicini per i centrali»: in una griglia 2×3 i centrali ne hanno tre. Il piano usa la griglia vera.)
- Limite di due carte per lato in ogni quarto; ogni quarto vale una corona (Campo d'argento compreso: niente doppia corona); il Campo stretto non entra nell'estrazione, perché il limite è già due.
- «Capo» e «punta» diventano riga alta e riga bassa: Delfino, Gallo, Stambecco e la Civetta continuano a funzionare con `s.map.top`.
- Cigno, Gufo, Orso, Grifone, Balena e Migrazione usano `s.map.near`. Il Grifone vuole «entrambi i quarti confinanti»: con tre vicini diventa «tutti i quarti confinanti», e va ritarato.
- Sei campi su sei quarti, dagli otto esistenti senza ripetizioni, escludendo il Campo stretto: restano sette campi per sei posti.
- Interfaccia: lo scudo diventa una tavola 3×2 con le pieghe; sotto i 720px resta 2 colonne × 3 righe. Va aggiunto al test responsive.

### `i` · Arcipelago (idea 29)

- Stessi quarti (quattro, o sei con `x`), ma `s.map.near` viene da una **mappa di rotte** estratta tra poche mappe fisse e mostrata prima della partita: ogni quarto ha una o due rotte.
- Obiettivo comune: +1 corona a chi tiene alla fine **due quarti collegati da una rotta**, una volta per partita. Nessun obiettivo nascosto.
- Volante e Marino non ricevono movimento gratuito. Le loro abilità restano quelle stampate.
- Lo scudo disegna le rotte come nastri tra i quarti; il testo «Rotte: I–III, II–IV» resta leggibile anche senza disegno.

---

## Ondata 4 — movimento

Il repertorio la indica come la famiglia più rischiosa: un solo movimento può riaprire quarti pieni, cambiare le tinture e più risultati insieme. Per questo è l'ultima ondata e ha un modello dati proprio.

### Modello dati: due turni per carta

- `at`: turno in cui la carta è uscita dalla mano. Non cambia mai.
- `in`: turno in cui la carta è entrata nel quarto dove si trova. Uguale ad `at` finché non si muove.
- Le abilità **d'ingresso** leggono `in`: Volpe, Cinghiale, Reazioni di Basilisco e Arpia, Tartaruga, Cicogna, Lepre, Picchio.
- Le abilità **del momento della posa** leggono `at`: Cavalletta e Civetta delle Ore. La Custodia dell'Orso (`guard`) resta quella fissata alla posa, come chiede l'idea 9.
- Finché nessuna carta si muove, `in === at`: il cambio è solo un rinomina interna, e il confronto con la 0.0.8 deve restare identico.

### `n` · Migrazione e Rondine (idee 9 e 10)

- **Migrazione:** una volta per partita, al posto di giocare una carta dalla mano, sposti una tua carta già sullo scudo in un quarto confinante con spazio libero. Consuma la mossa del turno.
- **Rondine** (forza 3, azzurro, Volante), abilità **Nomade:** può migrare una volta, in un turno successivo a quello della posa, anche se hai già usato la Migrazione. Anche il suo movimento sostituisce la mossa del turno.
- Nel turno in cui migri **non peschi**: la mano resta a quattro carte. Alla fine resta una carta non giocata: è il costo, come dice l'idea 9.
- La carta mossa va in fondo al quarto di arrivo: la legge delle tinture la confronta con l'ultima tua carta già lì. Prende campo, vicinanze e abilità del nuovo quarto; tiene `at` e `guard`; riceve `in = s.turn`.
- Simultaneità: le due mosse si validano sullo stato **prima** del turno, poi si applicano insieme, come oggi in `play()`. I limiti di carte sono per lato, quindi due mosse non si contendono lo stesso spazio.
- Validazione nell'engine (input non fidato): la carta è tua e sullo scudo, non si è già mossa, la destinazione è confinante e ha spazio, la Migrazione non è già usata (o la carta è una Rondine).
- Cronaca: «Rondine dal quarto II al quarto IV (Migrazione)». Il codice partita resta valido: le mosse non sono nel codice, solo le opzioni.

### `r` · Richiamo e Spostamento (idee 11 e 12) — solo se la 4a è stabile

Il repertorio sconsiglia entrambe per la prima prova. Il piano le tiene, con le versioni prudenti che il repertorio stesso indica, e le apre solo dopo che la Migrazione ha superato le sue verifiche.

- **Richiamo:** una volta per partita, una tua carta torna in mano al posto della mossa del turno, e **rinunci alla pesca** di quel turno. Quando la rigiochi riceve nuovi `at`, `in` e `guard`: è una nuova posa.
- **Spostamento dell'avversario:** solo come abilità di una carta, scelta tra due quarti confinanti entrambi con spazio, mai verso un quarto pieno. La carta spostata conserva tutto tranne `in`.
- Nessuna delle due entra nelle prime simulazioni di bilanciamento insieme ad altri moduli.

---

## Formati, combinazioni, codici

### Il formato Laboratorio

- Nuovo formato `lab` nel menu Partita, marcato «Sperimentale», con una scheda **Laboratorio** che elenca i moduli con una riga di spiegazione ciascuno e l'ondata a cui appartengono.
- Pool: le 12 carte del Bestiario più le quattro carte di ogni casata del Laboratorio attiva (`o`, `c`, `g`, `q`; la Rondine con `n`). Si estraggono 16 carte condivise dai due lati, come nel Crepuscolo. Con nessuna casata attiva il pool è il Classico.
- Draft, Classico, Crepuscolo e Prove non includono le carte del Laboratorio. Una carta esce dal Laboratorio solo con una decisione separata, dopo la taratura.
- Le regole facoltative esistenti (Editto, Rivalità) restano combinabili con il Laboratorio.

### Combinazioni vietate nella prima release

Il validatore delle opzioni (`create()` e `parseCode()`) rifiuta:

- `t` con `x`: durata e dimensione insieme (idea 28: «non aumentare insieme dimensione e durata»);
- `p` con `b`: due premi per il controllo nella stessa prova;
- `r` senza `n`;
- `i` con `n` o `r`: le rotte cambiano cosa vuol dire «confinante» proprio mentre si testa il movimento.

Le altre combinazioni sono permesse, ma la scheda Laboratorio avvisa quando ci sono più di due moduli attivi: «I risultati di questa partita dicono poco su ciascun modulo».

### Codici partita

- Formato `lab` ha la lettera `l`. I moduli seguono dopo un trattino, in ordine fisso e senza ripetizioni: `418273-lnsr-ocg`.
- `parseCode()` accetta solo le lettere dei moduli, nell'ordine canonico, senza doppioni e senza combinazioni vietate. Altrimenti il codice è rifiutato con un messaggio che dice perché.
- I codici senza suffisso restano quelli della 0.0.8.

### Preferenze salvate

- Nuova chiave `lab` in `blasone.prefs`: una stringa di lettere ammesse, letta con la stessa regola dei codici. Valori sbagliati si ignorano, come oggi per formato e stile del Conte.

---

## Il Conte nel Laboratorio

`choose()` prova già ogni carta in ogni quarto. Da estendere per modulo:

- **Ariete:** valuta ogni posa con e senza Scommessa (due candidati).
- **Migrazione e Richiamo:** candidati extra «muovi la carta k dal quarto a al quarto b». La mossa costa una carta non giocata: `value()` aggiunge una penalità fissa, da tarare in simulazione.
- **Presidio e Obiettivo:** `value()` aggiunge il valore atteso della corona che manca, come `watch()` fa oggi per le Reazioni.
- **Due tempi:** nel primo tempo il Conte gioca come oggi; nel secondo `value()` conta le corone depositate solo per decidere quanto rischiare (con `noise`).
- **Draft:** `RATE` riceve le nuove carte solo se un giorno entrano nel Draft. Non è previsto in questa versione.

Il Conte deve restare entro il 48–52% di vittorie contro sé stesso in ogni configurazione testata.

## Interfaccia

- **Carta:** famiglia stampata sotto il nome, con un simbolo e il nome per esteso (mai solo un colore); nastro di casata come oggi. Le nuove bestie senza glifo proprio (Gazza, Civetta delle Ore, Picchio, Cardellino, Tessitore, Cicogna, Rondine, Albatros, Pellicano, Ermellino) hanno un disegno PNG 256 px trasparente in `art/`, inciso come Grifone e Basilisco, con parti di emoji di riserva.
- **Scudo:** tacche di Presidio, campo mutevole annunciato, obiettivo di torneo sopra lo scudo, rotte dell'Arcipelago, tavola 3×2 dell'Arena.
- **Mano:** pulsante «Scommetti» accanto a «Dichiara l'Editto» quando l'Ariete è scelto; pulsante «Migra» quando una tua carta sullo scudo è scelta e la Migrazione è possibile.
- **Dettaglio della forza:** ogni voce nuova ha il suo nome: «Vantaggio: Volante su Terrestre», «Riparo (Pellicano): Gufo −1 annullato», «Scommessa persa −2», «Ritmo».
- **Riepilogo:** le corone del quarto elencano Base, Torri, Rivalità, Presidio, Obiettivo, Pavone, Editto, Ariete, ciascuna una volta, sommate da `prize()`.
- **Prontuario dell'araldo:** con `g` attivo aggiunge il ciclo delle famiglie (Volante → Terrestre → Marino → Volante); con `m` il campo che cambierà.
- **Bestiario:** filtro per famiglia e per casata; le carte del Laboratorio marcate «Laboratorio».
- **Feedback:** la scheda Riscontro aggiunge i moduli attivi e una domanda: «Quale regola nuova hai dovuto ricontrollare nel bestiario?». È il punto 4 della sequenza del repertorio (la regola si ricorda senza consultare il bestiario?).

## Sicurezza e accessibilità

- Moduli, codici e preferenze sono input non fidati: solo lettere note, ordine canonico, lunghezza massima, combinazioni ammesse, controllati nell'engine e non solo nel menu.
- Mosse di Migrazione, Richiamo e Scommessa validate in `play()`: la carta è del lato giusto, nel posto giusto, l'azione non è già usata, la destinazione è legale.
- Nessun testo di carta, obiettivo o mappa interpolato come HTML non fidato: tutto viene dal catalogo interno, passato per `esc()`.
- Movimento e Scommessa usabili da tastiera e touch, con focus coerente. Tacche, rotte e famiglie hanno testo e simbolo, non solo colore. Animazioni di movimento rispettano «Animazioni ridotte».

## Piano di bilanciamento e verifica

### Per ogni modulo, da solo

1. `node scripts/blasone-sim.js lab-<lettera> 1500` contro `lab` senza moduli (cioè il Classico): vittorie per lato, corone a partita, quota di corone portata dal modulo, quarti vinti dalle nuove carte.
2. Soglie di accettazione:
   - lati entro 48–52%;
   - ogni nuova carta tra il 36% e il 60% dei quarti vinti dove è giocata, la fascia delle casate esistenti;
   - nessun modulo-regola sopra un sesto delle corone di una partita, il peso della Rivalità nella 0.0.8;
   - per `n`: Migrazione usata in almeno il 20% delle partite del Conte e mai in più dell'80% (scelta reale, non obbligata né inutile).
3. Le varianti di simulazione elencate sopra (Gazza, Picchio, Civetta, Gambero, Ermellino, Cicogna, vantaggio B e C, Presidio a segnali) si provano cambiando **una sola** abilità per volta. Si tiene la variante più leggibile tra quelle entro le soglie.

### Poi in coppia

Solo le coppie della stessa ondata e quelle tra ondate chiuse, mai le combinazioni vietate. Una coppia è ammessa se i due moduli insieme restano entro le soglie di ciascuno.

### Controlli automatici (`scripts/blasone-check.js`)

- Laboratorio spento: Classico, Crepuscolo e Draft identici al motore 0.0.8 (git `c485a59`), come le verifiche già presenti per 0.0.6 e 0.0.7.
- Refactor dell'ondata 3: con la mappa predefinita, partite identiche.
- Modello `at`/`in`: senza movimenti, partite identiche.
- Per ogni carta nuova, almeno un caso in cui l'abilità scatta e uno in cui non scatta.
- Scudo: Serpe, Gufo, Basilisco annullati di un punto; Drago, Scorpione e campi no; due Pellicani = uno Scudo.
- Ariete: vinta, persa, persa per colpa del −2.
- Presidio: 4 turni su 6, Campo rovesciato, parità.
- Due tempi: corone depositate, Editto unico, spareggio.
- Arena e Arcipelago: vicini corretti per ogni mappa, limite di due carte, Grifone.
- Migrazione: ogni validazione rifiutata (carta non tua, già mossa, destinazione piena o non confinante, Migrazione già usata), nessuna pesca nel turno.
- Codici e preferenze: lettere ignote, ordine sbagliato, doppioni, combinazioni vietate, troppo lunghi.
- Interfaccia in Chrome headless: movimento e Scommessa da tastiera, riepilogo con tutte le voci di corona.

### Prove dell'Araldo

Una prova facoltativa per modulo, a partire dall'ondata 2, fuori da `TRIALS_SET`. Ogni prova dimostrata risolvibile da `scripts/blasone-prove.js`. Il Campo mutevole è prima di tutto una prova, come chiede il repertorio.

### Test umani

Almeno 10 partite per modulo da solo, poi 10 per ogni coppia ammessa. Le domande: la regola si ricorda senza il bestiario? La scelta sembra interessante o obbligata? A chi va la corona, e perché?

## Ordine di lavoro

1. Catalogo: campo `fam` per tutte le bestie, famiglia sulle carte e nel bestiario (nessuna regola).
2. Formato `lab`, moduli, codici, preferenze e validatore, senza moduli implementati: verifica che tutto il resto sia identico.
3. Ondata 1: `o`, `c`, `g` (Scudo compreso). Simulazioni, varianti, prove umane.
4. Ondata 2: `q`, `p`, `b`, `m`, con lo stato di storia in `play()`.
5. Refactor della mappa e dei turni, verificato identico. Poi ondata 3: `t`, `x`, `i`.
6. Modello `at`/`in`, verificato identico. Poi ondata 4a: `n`.
7. Solo se la 4a supera le soglie: ondata 4b, `r`.
8. Decisione di formato per ogni modulo: entra in una casata pubblica, resta nel Laboratorio, diventa una Prova, oppure si toglie.

Ogni passo si chiude con `node scripts/blasone-check.js`, `node scripts/blasone-prove.js`, `CI=true npm run build` e il test responsive.

## Criteri di accettazione

- Con il Laboratorio spento, ogni formato e ogni codice partita della 0.0.8 dà la stessa partita.
- Ogni modulo si accende e si spegne da solo, è descritto nel menu ed è scritto nel codice partita.
- Ogni nuova abilità e regola compare con il suo nome nel dettaglio della forza e nel riepilogo, senza doppi conteggi.
- Le combinazioni vietate sono rifiutate dall'engine, non solo nascoste dall'interfaccia.
- Ogni modulo ha superato da solo le soglie di simulazione prima di essere provato in coppia.
- Nessun problema di sicurezza aperto sui nuovi input: moduli, codici, preferenze, mosse di movimento e Scommessa.

## Fuori ambito

- Portare carte o regole del Laboratorio in Classico, Crepuscolo, Draft o nelle Prove del set iniziale.
- Il Duello tra Araldi (0.0.9), che resta un piano a parte e non dipende da questo.
- Cambi di forza o abilità alle carte esistenti, tranne il ritaro del Grifone nell'Arena.
- Rete, account, invio automatico di dati.

## Matrice delle idee

| # | Idea | Dove entra | Forma |
|---|---|---|---|
| 1 | Forza stampata pari/dispari | `o` | Gazza; *Doppia lettura* come variante |
| 2 | Parità del turno | `o` | Cavalletta |
| 3 | Parità del numero di carte | `o` | variante del Picchio |
| 4 | Totale stampato pari/dispari | `o` | variante della Gazza |
| 5 | Primogenitura, chiusura, sentinella | `q` | Cicogna, Lepre; Sentinella come variante |
| 6 | Finestra di turno, scadenza | `o` | Civetta delle Ore; Alba, Crepuscolo, Scadenza come varianti |
| 7 | Ritmo di posa | `o` | Picchio |
| 8 | Ingresso in un quarto occupato | `q` | varianti della Cicogna |
| 9 | Migrazione | `n` | regola, una volta per partita |
| 10 | Nomade | `n` | Rondine |
| 11 | Richiamo | `r` | regola, dopo la 4a |
| 12 | Spostamento dell'avversario | `r` | abilità prudente, dopo la 4a |
| 13 | Scommessa sul quarto | `q` | Ariete |
| 14 | Scudo o riserva | `g` | Scudo nel Pellicano; riserva rinviata |
| 15 | Dominio per maggioranza di casata | `q` | Pappagallo |
| 16 | Campo che cambia | `m` | regola annunciata, poi Prova |
| 17 | Obiettivo pubblico | `b` | tre obiettivi fissi |
| 18 | Compagnia cromatica | `c` | Cardellino, Tessitore |
| 19 | Assenza di un colore | `c` | Ermellino, Gambero; varianti |
| 20 | Repertorio cromatico | `c` | Salamandra pallida rinominata Ermellino |
| 21 | Famiglie | `g` | etichetta `fam` su tutte le carte |
| 22 | Vantaggi e vulnerabilità | `g` | solo vantaggio, poi varianti B e C |
| 23 | Carte delle famiglie | `g` | Albatros, Squalo, Bufalo; Araldo delle Bestie di riserva |
| 24 | Guardia contro i malus | `g` | Scudo |
| 25 | Pellicano Custode | `g` | carta |
| 26 | Due tempi | `t` | modalità |
| 27 | Presidio | `p` | soglia, poi segnali |
| 28 | Arena a sei quarti | `x` | modalità, griglia 2×3 |
| 29 | Arcipelago | `i` | mappe di rotte fisse |

## Registro versioni

| Versione | Stato | Ambito |
|---|---|---|
| 0.0.7 | Implementata | Draft delle Casate, Prove dell'Araldo, Compagnia delle Veglie e Reazione. |
| 0.0.8 | Implementata | Compagnia dei Confini, Rivalità di Casata, due prove facoltative. |
| 0.0.9 | Pianificata | Duello locale per due persone con mosse nascoste. |
| 0.0.10-lab | Ondate 1–2 implementate | Laboratorio dell'Araldo: tutte le meccaniche del repertorio come moduli sperimentali, in quattro ondate. |

## Esito dell'implementazione (ondate 1 e 2)

### Cosa c'è

- Formato **Laboratorio** (`lab`, lettera `l` nel codice) con sette moduli: `o` Casata delle Ore, `c` Compagnia dei Colori, `g` Tre Regni, `q` Compagnia della Giostra, `p` Presidio, `b` Obiettivo di torneo, `m` Campo mutevole. Si scelgono in Menu → Partita, sotto i formati, e si salvano in `blasone.prefs` come `lab`.
- Sedici bestie nuove in quattro casate (`lab: true` in `HOUSES`), con la famiglia stampata su tutte le carte, vecchie e nuove. Il bestiario cerca anche per famiglia, casata e «laboratorio».
- Codici: `418273-lns-ocg`. `validLab()` accetta solo lettere note, in ordine canonico, senza doppioni e senza Presidio con Obiettivo; lo usano engine, codici e preferenze.
- Scommessa dell'Ariete: pulsante «Scommetti sul quarto» accanto all'Editto, solo con l'Ariete scelto; Editto e Scommessa sulla stessa carta sono rifiutati da `play()`. Il Conte prova ogni Ariete con e senza Scommessa.
- Sullo scudo: sotto il nome del campo il cambio annunciato del Campo mutevole e i turni di Presidio; tra le corone le voci Obiettivo, Presidio e Ariete. Nel Prontuario il ciclo delle famiglie, l'Obiettivo e la regola del Presidio. Nel riepilogo una riga per ciascuna.
- Scheda Riscontro: moduli attivi e la domanda «Regola nuova che hai dovuto ricontrollare nel bestiario».

### Decisioni e deviazioni dal piano

- **Presidio a 5 turni su 6, non 4.** Con 4 su 6 il Presidio pagava 1,24 corone a partita, il 20% del totale, oltre il limite di un sesto. Con 5 su 6 paga 0,53 corone, il 10%. La versione a segnali resta da provare.
- **Pellicano:** il Riparo vale +1 se la carta ha almeno un malus di Serpe, Gufo, Basilisco o Arpia. Non tocca Drago, Scorpione, campi né la Scommessa persa.
- **Ariete in parità:** la Scommessa è persa (nessuno conquista il quarto), quindi −2, e il quarto passa all'altro lato.
- **Obiettivo «La prima punta»:** se III e IV sono condotti per la prima volta nello stesso turno, vale il III.
- **Disegni delle nuove bestie:** per ora parti di emoji incise come le altre (la Civetta con una clessidra, il Picchio su un ceppo, il Tessitore su un nido, il Pellicano con un pesce). I PNG dedicati in `art/` sono ancora da fare.
- Versione mostrata nel menu: `0.0.10-lab`.

### Bilanciamento (AI contro AI)

| Moduli | Partite | Tu / Conte | Corone a partita | Corone del modulo |
|---|---:|---|---:|---|
| nessuno (= Classico) | 1500 | 49 / 49 | 4,92 | — |
| `o` | 5000 | 50 / 48 | 4,63 | — |
| `c` | 1500 | 52 / 46 | 4,68 | — |
| `g` | 1500 | 52 / 45 | 4,62 | 3,4 vantaggi e 0,4 Ripari a partita |
| `q` | 5000 | 52 / 47 | 5,32 | Ariete 0,54 (10%); scommesse perse 51% |
| `p` | 1500 | 49 / 49 | 5,45 | Presidio 0,53 (10%) |
| `b` | 1500 | 48 / 50 | 5,50 | Obiettivo 0,70 (13%) |
| `m` | 1500 | 50 / 47 | 4,87 | — |
| `ocgq` | 5000 | 49 / 49 | 4,58 | — |

Lo scarto tra i lati è rumore del campione (su 5000 partite `o` e `ocgq` tornano entro 48–52); `q` resta al limite e va riguardato con l'Ariete. Quarti vinti dalle nuove bestie dove sono giocate (`ocgq`, 3000 partite): tra il 41% (Ermellino) e il 58% (Cicogna), dentro la fascia 36–60%. Il Conte gioca poco Picchio (7% delle partite) e Pellicano (9%): da osservare nei test umani, potrebbero essere carte che nessuno sceglie.

### Verifiche

- `node scripts/blasone-check.js`: 182 OK. Nuovo `scripts/blasone-check/lab.js`: Classico, Crepuscolo e Draft, con e senza Rivalità, identici all'engine 0.0.8 (`c485a59`); ogni nuova bestia con abilità attiva e spenta; vantaggio, Ripari, Scommessa (vinta, persa, in parità, rifiutata con l'Editto), Presidio, i tre Obiettivi, Campo mutevole; moduli e codici malformati. Nuovo `labui.js` in Chrome: pulsante Scommessa, cronaca, moduli del menu, coppia vietata. `security.js`: moduli malevoli nelle preferenze ignorati.
- `node scripts/blasone-prove.js`: 8 prove risolvibili.
- `CI=true npm run check:responsive`: 240 ok.

### Ancora da fare

- Ondata 3 (due tempi, arena a sei quarti, Arcipelago) dopo il refactor di mappa e turni; ondata 4 (Migrazione, Rondine, poi Richiamo e Spostamento) dopo il modello `at`/`in`.
- Le varianti di simulazione elencate per Gazza, Picchio, Civetta, Gambero, Ermellino, Cicogna, vantaggio B e C, Presidio a segnali.
- Le Prove dell'Araldo per modulo e i test umani (10 partite per modulo da solo).
