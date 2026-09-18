# isSlop

Local AI image detector. The extension lives in **`src/`**; build tooling lives at the repo root.
`scraper/` and `detection_pipeline/` are the original sources, kept for reference.

Everything runs on-device (ONNX inference + metadata forensics + C2PA content
credentials). No cloud, no remote code.

## Build

The runtime assets in `src/vendor/` are gitignored build artifacts. Regenerate them:

```
npm install        # esbuild + @contentauth/c2pa-web (build-time only)
node build.mjs     # bundles c2pa-web -> src/vendor/c2pa/, copies ONNX Runtime -> src/vendor/ort/
```

The model weights (`w5810_best_fp16.onnx`, ~42 MB, gitignored) must be present in
`detection_pipeline/` or `src/`; `build.mjs` copies it into `src/`. See
`src/model_manifest.json` for the pinned URL + sha256.

## Test locally (no extension load needed)

The harness runs the **real** `offscreen.js` engine in a normal page with `chrome.*`
stubbed, and dispatches both detection paths:

- `aid:infer` → `forensics.sniffMetadata` (PNG/JPEG structural markers incl. C2PA
  `trainedAlgorithmicMedia` URIs) → ONNX model. `ep:"metadata"` means forensics hit.
- `aid:c2pa` → `@contentauth/c2pa-web` full manifest reader (Web Worker + WASM).

```
python -m http.server 8080 --bind 127.0.0.1
```

- Open: `http://localhost:8080/src/harness.html`



import { sniffMetadata, checkMetaData } from "./forensics.js";