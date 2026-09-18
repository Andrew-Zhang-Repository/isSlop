// Vendors the runtime assets the src/ extension needs but that are not
// committed to git: the c2pa-web SDK (bundled), ONNX Runtime Web, and the
// model weights. Everything the extension runs ships inside src/ — no CDN,
// no remote code (MV3 forbids it).
//
//   node build.mjs        (after: npm install)
//
// Outputs:
//   src/vendor/c2pa/c2pa.js          esbuild bundle of @contentauth/c2pa-web (inlines `highgain`)
//   src/vendor/c2pa/c2pa_worker.js   verbatim (loaded at runtime via workerSrc)
//   src/vendor/c2pa/c2pa_bg.wasm     verbatim, byte-exact (loaded via wasmSrc)
//   src/vendor/ort/*                 ONNX Runtime Web (from node_modules, or the committed root copy)
//   src/w5810_best_fp16.onnx         model weights (if present locally)
import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");
const c2paPkg = join(here, "node_modules", "@contentauth", "c2pa-web");
const c2paDist = join(c2paPkg, "dist");
const c2paOut = join(src, "vendor", "c2pa");

// ---- c2pa-web -------------------------------------------------------------
// The published dist has a bare `import ... from "highgain"`, which a plain
// <script type=module> can't resolve, so bundle the main thread into one file.
// The worker and wasm are loaded at runtime by URL and ship verbatim.
rmSync(c2paOut, { recursive: true, force: true });
mkdirSync(c2paOut, { recursive: true });

await build({
  stdin: {
    contents: 'export { createC2pa, Reader } from "@contentauth/c2pa-web";',
    resolveDir: here,
    sourcefile: "c2pa-entry.js",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome124",
  outfile: join(c2paOut, "c2pa.js"),
  logLevel: "warning",
});
cpSync(join(c2paDist, "c2pa_worker.js"), join(c2paOut, "c2pa_worker.js"));
cpSync(join(c2paDist, "resources", "c2pa_bg.wasm"), join(c2paOut, "c2pa_bg.wasm"));

let c2paBytes = 0;
for (const f of ["c2pa.js", "c2pa_worker.js", "c2pa_bg.wasm"]) c2paBytes += statSync(join(c2paOut, f)).size;
console.log(`vendored @contentauth/c2pa-web -> src/vendor/c2pa/ (${(c2paBytes / 1e6).toFixed(1)}MB)`);

const exifOut = join(src, "vendor", "exifreader");
mkdirSync(exifOut, { recursive: true });
cpSync(join(here, "node_modules", "exifreader", "dist", "exif-reader.js"),
       join(exifOut, "exif-reader.js"));
console.log("vendored exifreader -> src/vendor/exifreader/exif-reader.js");

// ---- ONNX Runtime Web -----------------------------------------------------
// Prefer a fresh vendor from node_modules; fall back to the committed root
// copy so the build works even when onnxruntime-web isn't installed here.
const ortOut = join(src, "vendor", "ort");
const ortNpm = join(here, "node_modules", "onnxruntime-web", "dist");
const ortRoot = join(here, "vendor", "ort");
const ORT_KEEP = [
  "ort.webgpu.min.js",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];
mkdirSync(ortOut, { recursive: true });
if (existsSync(ortNpm)) {
  for (const f of ORT_KEEP) cpSync(join(ortNpm, f), join(ortOut, f));
  console.log("vendored onnxruntime-web -> src/vendor/ort/");
} else if (existsSync(ortRoot)) {
  for (const f of ORT_KEEP) {
    const from = join(ortRoot, f);
    if (existsSync(from)) cpSync(from, join(ortOut, f));
  }
  console.log("copied existing vendor/ort -> src/vendor/ort/");
} else {
  console.warn("WARN: no onnxruntime-web in node_modules and no root vendor/ort to copy");
}

// ---- model weights (gitignored artifact) ----------------------------------
const modelDst = join(src, "w5810_best_fp16.onnx");
for (const cand of [join(here, "src", "w5810_best_fp16.onnx"), modelDst]) {
  if (existsSync(cand)) {
    if (cand !== modelDst) cpSync(cand, modelDst);
    console.log(`model present -> src/w5810_best_fp16.onnx (${(statSync(modelDst).size / 1e6).toFixed(1)}MB)`);
    break;
  }
}
