/**
 * Options page logic
 */

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get([
    'apiBase',
    'cloudAnalysis',
    'enableChromeAI',
    'byokEnabled',
    'byokApiKey'
  ], (result) => {
    // Cloud settings
    document.getElementById('api-base').value = result.apiBase || 'https://api.kasra.one';
    document.getElementById('cloud-analysis').checked = result.cloudAnalysis !== false;

    // Chrome AI settings (default enabled)
    document.getElementById('enable-chrome-ai').checked = result.enableChromeAI !== false;

    // BYOK settings
    document.getElementById('byok-enabled').checked = result.byokEnabled || false;
    document.getElementById('byok-api-key').value = result.byokApiKey || '';

    // Show/hide nested settings
    updateNestedSettings();
  });
}

// Save settings
function saveSettings(e) {
  e.preventDefault();

  const apiBase = document.getElementById('api-base').value.trim();
  const cloudAnalysis = document.getElementById('cloud-analysis').checked;
  const enableChromeAI = document.getElementById('enable-chrome-ai').checked;
  const byokEnabled = document.getElementById('byok-enabled').checked;
  const byokApiKey = document.getElementById('byok-api-key').value.trim();

  // Validate cloud URL
  if (cloudAnalysis && apiBase && !isValidUrl(apiBase)) {
    showStatus('Please enter a valid API Base URL', 'error');
    return;
  }

  // Validate BYOK key
  if (byokEnabled && !byokApiKey) {
    showStatus('Please enter your OpenAI API key', 'error');
    return;
  }

  // Length validation (OpenAI keys are typically 50-60 characters, max 256 for safety)
  if (byokEnabled && byokApiKey.length > 256) {
    showStatus('API key seems too long (max 256 characters)', 'error');
    return;
  }

  // Warning for non-standard key format (but allow saving)
  if (byokEnabled && !byokApiKey.startsWith('sk-')) {
    showStatus('Warning: OpenAI API keys typically start with "sk-"', 'warning');
    // Continue to save despite warning
  }

  chrome.storage.sync.set({
    apiBase: apiBase || 'https://api.kasra.one',
    cloudAnalysis: cloudAnalysis,
    enableChromeAI: enableChromeAI,
    byokEnabled: byokEnabled,
    byokApiKey: byokApiKey,
    byokProvider: 'openai'  // Future: support other providers
  }, () => {
    showStatus('Settings saved successfully!', 'success');
  });
}

// Update visibility of nested settings
function updateNestedSettings() {
  const cloudEnabled = document.getElementById('cloud-analysis').checked;
  const byokEnabled = document.getElementById('byok-enabled').checked;

  document.getElementById('cloud-settings').style.display = cloudEnabled ? 'block' : 'none';
  document.getElementById('byok-settings').style.display = byokEnabled ? 'block' : 'none';
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
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Toggle nested settings visibility
  document.getElementById('cloud-analysis').addEventListener('change', updateNestedSettings);
  document.getElementById('byok-enabled').addEventListener('change', updateNestedSettings);
});

document.getElementById('options-form').addEventListener('submit', saveSettings);
