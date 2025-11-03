/**
 * Content script for extracting text and creating fallback overlay
 * This is injected when side panel is not available
 */

(function() {
  // Check if overlay already exists
  if (document.getElementById('clarifier-overlay')) {
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'clarifier-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    background: white;
    box-shadow: -2px 0 5px rgba(0,0,0,0.3);
    z-index: 10000;
    overflow: auto;
  `;

  // Create iframe for panel
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  iframe.src = chrome.runtime.getURL('src/panel.html');

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    width: 30px;
    height: 30px;
    border: none;
    background: #f44336;
    color: white;
    font-size: 20px;
    cursor: pointer;
    border-radius: 50%;
    z-index: 10001;
  `;
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);
})();
