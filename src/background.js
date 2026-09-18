// Service worker: routes analysis requests to the offscreen document, where
// every heavy dependency lives (ONNX inference, metadata forensics, C2PA
// reading). The SW itself is dependency-free on purpose: an MV3 service worker
// cannot create Web Workers and does not resolve bare npm imports, so neither
// c2pa-web nor ONNX Runtime can run here — they run in offscreen.js.

const OFFSCREEN_URL = "offscreen.html";
let offscreenReady = null;

// One offscreen document per extension; guard creation behind a shared promise.
function ensureOffscreen() {
  if (!offscreenReady) {
    offscreenReady = (async () => {
      if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_URL,
          reasons: ["WORKERS"],
          justification:
            "Local image analysis: ONNX inference, metadata forensics, and C2PA manifest reading (Web Worker + WASM).",
        });
      }
    })();
  }
  return offscreenReady;
}

async function toOffscreen(msg) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage(msg);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Full pipeline: forensics.js sniffMetadata (PNG/JPEG structural markers incl.
  // C2PA trainedAlgorithmicMedia URIs) runs first, then ONNX model inference.
  if (msg?.kind === "aid:analyze") {
    toOffscreen({ kind: "aid:infer", url: msg.url }).then(sendResponse);
    return true;
  }

  // Full C2PA content-credentials reader (@contentauth/c2pa-web): parses and
  // validates the manifest — claim_generator, signer, assertions, thumbnail.
  if (msg?.kind === "aid:c2pa") {
    toOffscreen({ kind: "aid:c2pa", url: msg.url }).then(sendResponse);
    return true;
  }

  if (msg?.kind === "aid:status") {
    toOffscreen({ kind: "aid:status" }).then(sendResponse);
    return true;
  }

  // Offscreen documents have no chrome.storage — proxy settings from here.
  if (msg?.kind === "aid:get-settings") {
    chrome.storage.sync.get({ forceWasm: false }, sendResponse);
    return true;
  }

  return false;
});
