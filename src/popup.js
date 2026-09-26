document.addEventListener('DOMContentLoaded', () => {
    const toggles = {
        runLinkedIn: document.getElementById('runLinkedIn'),
        runYouTube: document.getElementById('runYouTube'),
        runOthers: document.getElementById('runOthers'),
        whiteBinded: document.getElementById('whiteOutToggleBinded')
    };

    // Load saved settings (Default to running everywhere)
    chrome.storage.local.get({
        runLinkedIn: true,
        runYouTube: true,
        runOthers: true,
        whiteBinded: false
    }, (res) => {
        toggles.runLinkedIn.checked = res.runLinkedIn;
        toggles.runYouTube.checked = res.runYouTube;
        toggles.runOthers.checked = res.runOthers;
        toggles.whiteBinded.checked = res.whiteBinded;
    });

    // Save changes when user clicks a checkbox
    Object.entries(toggles).forEach(([key, element]) => {
        element.addEventListener('change', (e) => {
            chrome.storage.local.set({ [key]: e.target.checked });
        });
    });
});