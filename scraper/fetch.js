import {call} from "../detection_pipeline/harness"

const THRESHOLD = 0.65;
let config = { grayOutAi: true };

function img_find() {
    var imgs = Array.from(document.getElementsByTagName('img'));
    var filtered = imgs.filter(img => {

        if (img.dataset.aiStatus) return false;
        const rect = img.getBoundingClientRect();

        const largeEnough =
            rect.width >= 300 &&
            rect.height >= 200;

        const bounds = rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0

        const isValidSrc = img.src && img.src.startsWith("http");
        return (
            bounds && largeEnough && isValidSrc
        );
    });

    filtered.forEach(img => {
  
    img.dataset.aiStatus = "pending";
    processImage(img);
  });
}

async function processImage(img){
    const url = img.url || img.src;
    try{
        const r = await call({ kind: "aid:infer", url });
        const t0 = performance.now();
        const ms = Math.round(performance.now() - t0);
            console.log(`[Infer] ${url.substring(0, 40)}... => Score: ${r?.ok ? r.score.toFixed(4) : "ERROR"} in ${ms}ms`);
            
        if (!r || !r.ok) {
            img.dataset.aiStatus = "error";
            return;
        }

        // 4. Update the dataset status
        const isAi = r.score >= THRESHOLD && !r.degraded;
        if (isAi == true){
            img.dataset.aiStatus = "ai"
        }
        else{
            img.dataset.aiStatus = "human"
        }

        attachBadge(r.score,img,isAi);
    }
    catch(error){
        console.error("Inference failed for", url, err);
        img.dataset.aiStatus = "error";
    }
   
}

function attachBadge(score, img,isAi){
    const parent = img.parentElement;
    if (!parent) return;
    
    parent.classList.add("ai-scan-container");
    
    const badge = document.createElement("div");
    badge.className = `ai-confidence-badge ${isAi ? "ai-flagged" : "human-flagged"}`;
    const pct = (score * 100).toFixed(0);
    badge.textContent = isAi ? `AI ${pct}%` : `Real ${(100 - pct).toFixed(0)}%`;
    
    badge.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        img.classList.toggle("ai-image-grayed");
    });
    
    parent.appendChild(badge);

}
function updateVisuals(img,isAi){
    if (isAi && config.grayOutAi == true){
        img.classList.add("ai-image-grayed");
    }
    else{
        img.classList.remove("ai-image-grayed")
    }
}
img_find()