/**
 * Background service worker for Argument Clarifier extension
 */

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Try to use side panel API if available (Chrome 114+)
    if (chrome.sidePanel) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      // Fallback: inject content script that creates overlay
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/contentScript.js']
      });
    }
  } catch (error) {
    console.error('Error opening panel:', error);
  }
});

// Listen for messages from content script or panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPanel') {
    chrome.action.openPopup();
  }
  return true;
});
