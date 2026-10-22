// Builds public/designs/benchmark/data.json from public sources:
// - Epoch AI Benchmarking Hub (CC BY 4.0): the Epoch Capabilities Index and
//   every benchmark result it is built from, plus Humanity's Last Exam;
// - OpenRouter's public model list: prices per million tokens and context;
// - Artificial Analysis (free API key in AA_API_KEY, optional): its indexes,
//   speed and blended price.
// A source that fails keeps its part of the previous data.json, so a bad day
// upstream never empties the page. Runs on Node 18 with no dependencies.
// usage: node scripts/ai-bench/fetch.mjs   (AA_API_KEY=... to add Artificial Analysis)
import { readFileSync, writeFileSync, existsSync } from "fs";
import { inflateRawSync } from "zlib";
import { fileURLToPath } from "url";
import path from "path";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/designs/benchmark/data.json");
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const now = new Date().toISOString();

// ---------- tiny zip reader: central directory, then each stored or deflated entry ----------
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = method === 0 ? raw : inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ---------- CSV with quoted fields and newlines inside quotes ----------
function csv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') field += '"', i++;
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, k) => [h, r[k] ?? ""])));
}

const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

async function get(url, opts) {
  const r = await fetch(url, { ...opts, headers: { "user-agent": "burlibu.github.io benchmark page", ...(opts && opts.headers) } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
}

// ---------- Epoch AI ----------
async function epoch() {
  const files = unzip(Buffer.from(await (await get("https://epoch.ai/data/benchmark_data.zip")).arrayBuffer()));
  const read = (n) => csv(files[n].toString("utf8"));
  const eci = read("epoch_capabilities_index/eci_scores.csv");
  const meta = read("benchmark_metadata.csv");
  const points = read("epoch_capabilities_index/processed_data_for_eci.csv");

  const models = eci
    .map((m) => ({
      name: m["Display name"] || m.Model,
      key: m.Model,
      org: m.Organization || null,
      country: m["Country (of organization)"] || null,
      date: m.date || null,
      access: m["Model accessibility"] || "Unknown",
      open: m["Accessibility group"] === "Open weights" ? 1 : m["Accessibility group"] === "Closed weights" ? 0 : null,
      eci: num(m.eci),
      lo: num(m.eci_ci_low),
      hi: num(m.eci_ci_high),
      s: {},
    }))
    .filter((m) => m.eci != null)
    .sort((a, b) => b.eci - a.eci);
  const byKey = Object.fromEntries(models.map((m) => [m.key, m]));

  // every result behind the index, as a 0-1 share, keyed by benchmark name
  const benches = {};
  for (const p of points) {
    const m = byKey[p.Model], v = num(p.performance);
    if (!m || v == null) continue;
    m.s[p.benchmark] = round(v);
    const b = (benches[p.benchmark] ||= { name: p.benchmark, released: p.benchmark_release_date || null, n: 0 });
    b.n++;
  }
  for (const b of meta) {
    const x = benches[b.benchmark];
    if (!x) continue;
    x.eci = b.in_eci === "True";
    x.baseline = num(b.random_baseline);
    x.ceiling = num(b.score_ceiling);
    x.superseded = b.superseded_by || null;
  }

  // Humanity's Last Exam sits outside the index, with names of its own
  const hle = files["hle_external.csv"]
    ? read("hle_external.csv")
        .map((r) => ({ name: r.Name || r["Model version"], org: r.Organization || null, date: r["Release date"] || null, v: round(num(r.Accuracy)) }))
        .filter((r) => r.v != null)
    : [];

  models.forEach((m) => delete m.key);
  return {
    models,
    benchmarks: Object.values(benches).sort((a, b) => b.n - a.n),
    extra: { "Humanity's Last Exam": hle },
  };
}

// ---------- OpenRouter: every listed model with its price and context ----------
async function openrouter() {
  const { data } = await (await get("https://openrouter.ai/api/v1/models")).json();
  return data
    .map((m) => ({
      id: m.id,
      name: m.name,
      created: m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : null,
      ctx: m.context_length || null,
      out: (m.top_provider && m.top_provider.max_completion_tokens) || null,
      // dollars per token -> dollars per million tokens
      pin: m.pricing && num(m.pricing.prompt) != null ? round(num(m.pricing.prompt) * 1e6, 4) : null,
      pout: m.pricing && num(m.pricing.completion) != null ? round(num(m.pricing.completion) * 1e6, 4) : null,
      mod: (m.architecture && m.architecture.modality) || null,
      cutoff: m.knowledge_cutoff || null,
    }))
    .filter((m) => m.pin == null || m.pin >= 0);
}

// ---------- Artificial Analysis (needs a free key) ----------
async function artificialAnalysis() {
  const key = process.env.AA_API_KEY;
  if (!key) return null;
  const { data } = await (await get("https://artificialanalysis.ai/api/v2/data/llms/models", { headers: { "x-api-key": key } })).json();
  const e = (m, k) => (m.evaluations ? num(m.evaluations[k]) : null);
  return data.map((m) => ({
    name: m.name,
    creator: (m.model_creator && m.model_creator.name) || null,
    date: m.release_date || null,
    intel: e(m, "artificial_analysis_intelligence_index"),
    coding: e(m, "artificial_analysis_coding_index"),
    math: e(m, "artificial_analysis_math_index"),
    price: m.pricing ? num(m.pricing.price_1m_blended_3_to_1) : null,
    tps: num(m.median_output_tokens_per_second),
    ttft: num(m.median_time_to_first_token_seconds),
  }));
}

const out = { updated: now, sources: {} };
for (const [id, run] of [["epoch", epoch], ["openrouter", openrouter], ["aa", artificialAnalysis]]) {
  try {
    const v = await run();
    if (v == null) {
      out.sources[id] = { status: "off" };
      continue;
    }
    out[id] = v;
    out.sources[id] = { status: "ok", fetched: now };
    console.log(`${id}: ok`);
  } catch (e) {
    // keep yesterday's copy rather than an empty page
    out[id] = old[id] ?? null;
    out.sources[id] = { status: "stale", error: String(e.message || e).slice(0, 200), fetched: old.sources?.[id]?.fetched ?? null };
    console.warn(`${id}: ${e.message}`);
  }
}
writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT} (${Math.round(JSON.stringify(out).length / 1024)} KB)`);
