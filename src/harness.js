// Local test harness: runs the REAL offscreen.js engine in a normal browser
// page with chrome.* stubbed, so no extension load is needed.
//
//   python -m http.server 8080        (from the repo root)
//   http://localhost:8080/src/harness.html
//   http://localhost:8080/src/harness.html?c2pa=/tests/credentialed.jpg
//
// It dispatches both detection paths so you can see them fire:
//   aid:infer -> offscreen.infer() -> forensics.sniffMetadata (metadata + C2PA
//                markers) -> ONNX model. ep:"metadata" means forensics hit.
//   aid:c2pa  -> offscreen.readC2pa() -> @contentauth/c2pa-web full manifest.

const BASE = new URL(".", import.meta.url).pathname; // "/src/" when served from repo root

// ---- chrome stub (offscreen.js touches exactly these) ----
const listeners = [];
globalThis.chrome = {
  runtime: {
    getURL: (p) => BASE + p,
    sendMessage: async (msg) => (msg?.kind === "aid:get-settings" ? { forceWasm: false } : undefined),
    onMessage: { addListener: (fn) => listeners.push(fn) },
  },
};

// ---- navigator.storage (OPFS) stub: model.onnx streamed from the server,
//      model_meta.json backed by localStorage so the WASM self-test reference
//      logit survives reloads (skips rebuilding the reference session) ----
const META_KEY = "isslop.model_meta.json";
const handle = (name) => ({
  getFile: async () => {
    if (name === "model.onnx") {
      const r = await fetch(BASE + "w5810_best_fp16.onnx");
      if (!r.ok) throw new Error(`model fetch ${r.status}`);
      return r.blob();
    }
    const cached = localStorage.getItem(META_KEY);
    if (name === "model_meta.json" && cached !== null)
      return new Blob([cached], { type: "application/json" });
    throw new DOMException("not found", "NotFoundError"); // -> loadMeta() falls back to bundled manifest
  },
  createWritable: async () => {
    let buf = "";
    return {
      write: async (d) => { buf += typeof d === "string" ? d : await d.text(); },
      close: async () => { if (name === "model_meta.json") localStorage.setItem(META_KEY, buf); },
    };
  },
});
Object.defineProperty(navigator, "storage", {
  configurable: true,
  value: { getDirectory: async () => ({ getFileHandle: async (name) => handle(name) }) },
});

// ---- driver: replicates background.js's side of the contract ----
const call = (msg, timeoutMs = 300000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timeout: ${msg.kind}`)), timeoutMs);
  const done = (r) => { clearTimeout(t); resolve(r); };
  for (const fn of listeners) if (fn(msg, null, done) === true) return;
  clearTimeout(t);
  reject(new Error(`no listener handled ${msg.kind}`));
});

const out = document.getElementById("out");
const log = (s) => { out.textContent += s + "\n"; console.log(s); };

await import("./offscreen.js"); // MUST be dynamic: stubs have to exist before its top level runs

const st = await call({ kind: "aid:status" }); // warms the ONNX session (WebGPU + WASM self-test)
log(`session: ready=${st?.ready} ep=${st?.ep ?? "?"} selftest=${st?.selftest ?? "?"} version=${st?.version ?? "?"}${st?.error ? ` error=${st.error}` : ""}`);

const THRESHOLD = 0.65;
const verdict = (r) => {
  if (!r || !r.ok) return `ERROR ${r?.error ?? "no response"}`;
  const pct = (r.score * 100).toFixed(1);
  if (r.score >= THRESHOLD && !r.degraded) return `AI ${pct}%`;
  if (r.score >= 0.5 || (r.score >= THRESHOLD && r.degraded)) return `unsure ${pct}%`;
  return `clean ${pct}%`;
};


// c2pa is checked in infer in offscreen is it not as it takes it from the forensics.js file
// ---- 1. inference + metadata forensics ------------------------------------
// infer() ALWAYS runs forensics.js sniffMetadata first (offscreen.js:423):
// PNG tEXt/iTXt (SD "parameters", ComfyUI "prompt"/"workflow"), JPEG APP11/APP1,
// and C2PA digitalSourceType URIs. A structural hit short-circuits to 0.99 with
// ep:"metadata" + reason. ep:"webgpu"/"wasm" means forensics ran and missed.
const FILES = ["/tests/a1.png", "/tests/a2.png", "/tests/h1.png", "/tests/h2.png"];
const rows = [];
for (const url of FILES) {
  const t0 = performance.now();
  const r = await call({ kind: "aid:infer", url });
  rows.push({
    file: url.split("/").pop(), verdict: verdict(r),
    score: r?.ok ? r.score.toFixed(4) : "-", ep: r?.ep ?? "-", reason: r?.reason ?? "-",
    tta: r?.tta ?? "-", degraded: r?.degraded ?? "-", ms: r?.ms ?? "-",
    wallMs: Math.round(performance.now() - t0),
    signal: r?.signal,
    detection: r?.detection
  });
  const row = rows.at(-1);
  log(`${row.file.padEnd(9)} ${row.verdict.padEnd(12)} score=${row.score} ep=${row.ep} reason=${row.reason} ${row.ms}ms metadataresponse=${row.signal} AiAuthor=${row.detection}`);
}
console.table(rows);

/*
// ---- 2. C2PA content-credentials reader (@contentauth/c2pa-web) -----------
// Distinct from the forensics sniffer: this parses + validates the full
// manifest. Spins up the c2pa Web Worker + WASM on first call. Most plain
// images carry no manifest (found:false) — that still proves the path runs.
// Use ?c2pa=<url> to target a Content-Credentials image for a positive read.
const c2paUrl = new URLSearchParams(location.search).get("c2pa") || FILES[0];
const c = await call({ kind: "aid:c2pa", url: c2paUrl });
log(`\nc2pa[${c2paUrl.split("/").pop()}]: ok=${c?.ok} found=${c?.found}${c?.error ? ` error=${c.error}` : ""}`);
if (c?.found && c.active) {
  log(`  claim_generator: ${c.active.claim_generator ?? "?"}`);
  log(`  active manifest:\n${JSON.stringify(c.active, null, 2).slice(0, 1200)}`);
}
console.log("c2pa full result:", c);
*/
