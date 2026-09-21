

const THRESHOLD = 0.65;
let config = { grayOutAi: true, whiteOutAll:false};

const overlayLayer = document.createElement("div");
overlayLayer.id = "ai-badge-layer";
document.body.appendChild(overlayLayer);
const activeBadges = new Map();


chrome.storage.onChanged.addListener((changes) => {
    if (changes.whiteOutAll !== undefined) {
        config.whiteOutAll = changes.whiteOutAll.newValue;
    }
});

chrome.storage.local.get(['whiteOutAll'], (res) => {
    if (res.whiteOutAll !== undefined) config.whiteOutAll = res.whiteOutAll;
});


const imageObserver = new IntersectionObserver(function(entries, observer) {

    entries.forEach(function(entry) {
        if (entry.isIntersecting) {

            const img = entry.target;
            if (img.dataset.aiStatus) {
                return;
            }
            const rect = img.getBoundingClientRect();
            const largeEnough = rect.width >= 70 && rect.height >= 70;
            const isValidSrc = img.src && img.src.startsWith("http");
            const isLinkedInAvatar = img.src.includes("profile-displayphoto") || 
                                    img.src.includes("profile-framedphoto") || 
                                    img.src.includes("company-logo");

            const style = window.getComputedStyle(img);
            const isCircular = style.borderRadius === "50%";

            if (largeEnough && isValidSrc && !isLinkedInAvatar && !isCircular) {

                if (config.whiteOutAll) {
                    img.dataset.aiStatus = "whited-out";
                    img.classList.add("ai-image-whited-out");
                    attachManualRevealBadge(img);
                    observer.unobserve(img);
                    return;
                }


                img.dataset.aiStatus = "pending";
                processImage(img);
                observer.unobserve(img); 
            }
        }
    });

}, {
});

async function processImage(img) {
    const url = img.currentSrc || img.src; 
    
    try {
     
        const r = await chrome.runtime.sendMessage({ kind: "aid:analyze", url });
        
        if (!r || !r.ok) {
            img.dataset.aiStatus = "error";
            return;
        }

        const isAi = r.score >= THRESHOLD && !r.degraded;
        img.dataset.aiStatus = isAi ? "ai" : "human";

        if (isAi){
            config.grayOutAi = true;
        }
        else{
          config.grayOutAi = false;
        }
        
        attachBadge(r.score, img,isAi);
        updateVisuals(img, isAi);

    } catch (err) {
        console.error("Inference failed", err);
        img.dataset.aiStatus = "error";
    }
}

function attachBadge(score, img,isAi){
    const parent = img.parentElement;
    if (!parent) return;
    const rect = img.getBoundingClientRect();
    parent.classList.add("ai-scan-container");
    const wrapper = document.createElement("div");
    wrapper.className = "ai-badge-wrapper";

    const badge = document.createElement("div");
    badge.className = `ai-confidence-badge ${isAi ? "ai-flagged" : "human-flagged"}`;
    const pct = (score * 100).toFixed(0);
    badge.textContent = isAi ? `AI ${pct}%` : `Real ${(100 - pct).toFixed(0)}%`;

    const toggleButton = document.createElement("div");
    toggleButton.className = `toggle-badge`;
    
    toggleButton.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        img.classList.toggle("ai-image-grayed");
    });

    if (config.grayOutAi == true) {
   
      toggleButton.textContent = "Potential AI image (click to this to view)";
    }
    else{
      toggleButton.textContent = "Grey Out Toggle"
    }
    
 
    wrapper.appendChild(badge);
    wrapper.appendChild(toggleButton);
    overlayLayer.appendChild(wrapper);

    activeBadges.set(img, wrapper);
    updateBadgePosition(img, wrapper);

}

function updateBadgePosition(img, wrapper) {
  const rect = img.getBoundingClientRect();
  
  const isOffscreen = 
    rect.bottom <= 0 || 
    rect.top >= window.innerHeight ||
    rect.right <= 0 || 
    rect.left >= window.innerWidth;

  if (rect.width === 0 || rect.height === 0 || isOffscreen) {
    wrapper.style.opacity = "0";
    return;
  }
  
  wrapper.style.opacity = "1";
  wrapper.style.top = `${rect.top + 10}px`;
  wrapper.style.left = `${rect.left + rect.width - 10}px`;
}


window.addEventListener("scroll", () => {
  activeBadges.forEach((wrapper, img) => updateBadgePosition(img, wrapper));
}, { capture: true, passive: true });

window.addEventListener("resize", () => {
  activeBadges.forEach((wrapper, img) => updateBadgePosition(img, wrapper));
});

function updateVisuals(img,isAi){
    if (isAi && config.grayOutAi == true){
        img.classList.add("ai-image-grayed");
    }
    else{
        img.classList.remove("ai-image-grayed")
    }
}

const domObserver = new MutationObserver(function(mutations){
  mutations.forEach(function(mutation) {
    
      mutation.addedNodes.forEach(function(node){
        if (node.nodeType === 1) {
          if (node.tagName === "IMG") {
            imageObserver.observe(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll("img").forEach(function(img) {imageObserver.observe(img)});
          }
        }
      });
    });
  
    activeBadges.forEach(function(wrapper, img) {
    if (!img.isConnected) {
      wrapper.remove();         
      activeBadges.delete(img); 
    } else {
      updateBadgePosition(img, wrapper);
    }
    

  });
});


function attachManualRevealBadge(img) {
    const parent = img.parentElement;
    if (!parent) return;
    parent.classList.add("ai-scan-container");
    
    const wrapper = document.createElement("div");
    wrapper.className = "ai-badge-wrapper";

    const revealBtn = document.createElement("div");
    revealBtn.className = "toggle-badge";
    revealBtn.textContent = "Image Hidden. Click to Reveal & Scan.";
    revealBtn.style.background = "#2b6cb0"; // Make it a distinct blue color
    
    revealBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
      
        img.classList.remove("ai-image-whited-out");

        wrapper.remove();
        activeBadges.delete(img);
        
        img.dataset.aiStatus = "pending";
        processImage(img);
    });

    wrapper.appendChild(revealBtn);
    overlayLayer.appendChild(wrapper);

    activeBadges.set(img, wrapper);
    updateBadgePosition(img, wrapper);
}

domObserver.observe(document.body, { childList: true, subtree: true });

document.querySelectorAll("img").forEach(img => imageObserver.observe(img));


