
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
  if (msg?.kind === "aid:analyze") {
    toOffscreen({ kind: "aid:infer", url: msg.url }).then(sendResponse);
    return true;
  }


  if (msg?.kind === "aid:c2pa") {
    toOffscreen({ kind: "aid:c2pa", url: msg.url }).then(sendResponse);
    return true;
  }

  if (msg?.kind === "aid:status") {
    toOffscreen({ kind: "aid:status" }).then(sendResponse);
    return true;
  }


  if (msg?.kind === "aid:get-settings") {
    chrome.storage.sync.get({ forceWasm: false }, sendResponse);
    return true;
  }

  return false;
});
