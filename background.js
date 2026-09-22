// Minimal background service worker.
// Currently no persistent background logic is needed; all work happens
// in popup.js (UI) and content.js (page highlighting), triggered on demand.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["words"], (data) => {
    if (!data.words) {
      chrome.storage.sync.set({ words: [] });
    }
  });
});
