/**
 * Options page logic
 */

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get(['apiBase', 'cloudAnalysis'], (result) => {
    document.getElementById('api-base').value = result.apiBase || 'https://api.kasra.one';
    document.getElementById('cloud-analysis').checked = result.cloudAnalysis !== false;
  });
}

// Save settings
function saveSettings(e) {
  e.preventDefault();

  const apiBase = document.getElementById('api-base').value.trim();
  const cloudAnalysis = document.getElementById('cloud-analysis').checked;

  // Validate URL
  if (apiBase && !isValidUrl(apiBase)) {
    showStatus('Please enter a valid URL', 'error');
    return;
  }

  chrome.storage.sync.set({
    apiBase: apiBase || 'https://api.kasra.one',
    cloudAnalysis: cloudAnalysis
  }, () => {
    showStatus('Settings saved successfully!', 'success');
  });
}

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');

  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('options-form').addEventListener('submit', saveSettings);
