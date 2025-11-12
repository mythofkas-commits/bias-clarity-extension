# Testing Guide: Hybrid Analysis System

This guide helps you test all fallback scenarios in the Argument Clarifier extension.

## Testing Scenarios

### Scenario 1: Chrome Built-in AI (Priority 1)

**Setup:**
1. Use Chrome 127+ with AI features enabled
2. Go to `chrome://flags/#optimization-guide-on-device-model`
3. Enable "Prompt API for Gemini Nano"
4. Restart Chrome
5. Wait for model to download (check `chrome://components/`)

**Test:**
1. Open extension settings
2. Enable "Chrome Built-in AI" (should be enabled by default)
3. Disable "Use My Own API Key" and "Enable hosted cloud service"
4. Navigate to any article page
5. Click the extension icon and analyze
6. **Expected:** Mode indicator shows "✓ Chrome Built-in AI (private, local)"

**Verify:**
- Analysis completes successfully
- No network requests to external servers (check DevTools Network tab)
- Results include claims, assumptions, cues, etc.

---

### Scenario 2: BYOK - Bring Your Own Key (Priority 2)

**Setup:**
1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Ensure you have credits in your OpenAI account

**Test:**
1. Open extension settings
2. Disable "Chrome Built-in AI"
3. Enable "Use My Own API Key"
4. Enter your OpenAI API key (starts with `sk-...`)
5. Save settings
6. Navigate to any article page
7. Click the extension icon and analyze
8. **Expected:** Mode indicator shows "✓ Your API Key (custom)"

**Verify:**
- Analysis completes successfully
- Network request goes directly to `api.openai.com` (check DevTools)
- Token usage is shown in the confidence text
- Your OpenAI account shows the API usage

---

### Scenario 3: Cloud Service (Priority 3)

**Setup:**
1. Start your backend server: `cd server && npm run dev`
2. Ensure server is running on `http://localhost:3000`
3. Verify health endpoint: `curl http://localhost:3000/health`

**Test:**
1. Open extension settings
2. Disable "Chrome Built-in AI" and "Use My Own API Key"
3. Enable "Enable hosted cloud service"
4. Set API Base URL to `http://localhost:3000` (or your production URL)
5. Save settings
6. Navigate to any article page
7. Click the extension icon and analyze
8. **Expected:** Mode indicator shows "✓ Cloud Analysis (GPT-4)"

**Verify:**
- Analysis completes successfully
- Network request goes to your server (check DevTools)
- Server logs show the request
- Token usage is displayed

---

### Scenario 4: Local Heuristics Fallback (Priority 4)

**Test:**
1. Open extension settings
2. Disable ALL options:
   - Uncheck "Chrome Built-in AI"
   - Uncheck "Use My Own API Key"
   - Uncheck "Enable hosted cloud service"
3. Save settings
4. Navigate to any article page
5. Click the extension icon and analyze
6. **Expected:** Mode indicator shows "⚠ Local Heuristics (fallback)"

**Verify:**
- Analysis completes (no errors)
- Limited results (basic cues and inferences only)
- No network requests
- Warning message suggests enabling better analysis methods

---

### Scenario 5: Cascade Fallback Test

**Purpose:** Test that the system tries each method in order and falls back gracefully.

**Test:**
1. Open extension settings
2. Enable ALL options:
   - Enable "Chrome Built-in AI"
   - Enable "Use My Own API Key" (but enter an INVALID key like `sk-invalid123`)
   - Enable "Enable hosted cloud service" (but use wrong URL like `https://invalid.example.com`)
3. Save settings
4. Navigate to any article page
5. Click the extension icon and analyze

**Expected Behavior:**
1. Try Chrome AI first → If unavailable, continue
2. Try BYOK → Should fail with invalid key, continue
3. Try Cloud Service → Should fail with network error, continue
4. Fallback to Local Heuristics → Success

**Verify:**
- Extension doesn't crash
- User sees final result (even if from heuristics)
- Console logs show each attempt and reason for failure
- Final mode indicator shows which method succeeded

---

### Scenario 6: Chrome AI Unavailable → Cloud Success

**Test:**
1. Use Chrome version < 127 (or without AI flags enabled)
2. Enable "Chrome Built-in AI" and "Enable hosted cloud service"
3. Set valid cloud API URL
4. Disable BYOK
5. Analyze a page

**Expected:**
- Chrome AI check fails (not available)
- Falls back to cloud service successfully
- Mode indicator shows "✓ Cloud Analysis (GPT-4)"

---

### Scenario 7: All Premium Methods Fail → Heuristics

**Test:**
1. Enable Chrome AI (but on unsupported browser)
2. Enable BYOK with invalid/expired key
3. Enable Cloud with server turned off
4. Analyze a page

**Expected:**
- All three methods fail
- Extension falls back to heuristics
- User still gets some basic analysis
- Mode shows "⚠ Local Heuristics (fallback)"

---

## Testing Checklist

Use this checklist to ensure complete coverage:

- [ ] Chrome AI works when available
- [ ] Chrome AI gracefully skips when unavailable
- [ ] BYOK works with valid OpenAI key
- [ ] BYOK fails gracefully with invalid key
- [ ] Cloud service works when server is up
- [ ] Cloud service fails gracefully when server is down
- [ ] Local heuristics always work as final fallback
- [ ] Settings page shows/hides nested options correctly
- [ ] Settings are persisted across browser restarts
- [ ] Mode indicator updates correctly for each method
- [ ] No extension crashes in any scenario
- [ ] Console logs are helpful for debugging

---

## Common Issues & Debugging

### Chrome AI Not Available

**Symptoms:** Always skips Chrome AI even with Chrome 127+

**Debug:**
1. Check `chrome://components/` for "Optimization Guide On Device Model"
2. Should show version number (not "0.0.0.0")
3. If shows "0.0.0.0", click "Check for update"
4. Wait for download (can take several minutes)
5. Open DevTools console and run:
   ```javascript
   await window.ai.languageModel.capabilities()
   ```
6. Should return `{available: "readily"}` or `{available: "after-download"}`

### BYOK Fails with 401

**Symptoms:** "OpenAI API error: 401"

**Debug:**
- Check your API key is correct
- Verify key is active at https://platform.openai.com/api-keys
- Ensure your OpenAI account has credits
- Check key hasn't been rotated/revoked

### Cloud Service Connection Failed

**Symptoms:** "Server error: Failed to fetch"

**Debug:**
- Verify server is running: `curl http://localhost:3000/health`
- Check API Base URL in settings matches server URL
- Ensure no CORS issues (check browser console)
- Verify firewall isn't blocking the connection

### No Results or Empty Analysis

**Symptoms:** Analysis completes but shows empty sections

**Debug:**
- Check console for errors
- Verify the page has enough text content (>50 characters)
- Try a different article/page
- Check which analysis mode was used (mode indicator)

---

## Performance Testing

### Speed Comparison

Test the same article with each method and record timing:

1. **Chrome AI:** Typically 3-8 seconds
2. **BYOK:** Typically 5-15 seconds (depends on OpenAI API)
3. **Cloud Service:** Typically 5-20 seconds (depends on server location)
4. **Local Heuristics:** < 1 second

### Cost Comparison

For a 2000-word article:

1. **Chrome AI:** Free (runs locally)
2. **BYOK:** ~$0.02-0.05 (user pays OpenAI directly)
3. **Cloud Service:** Your server costs (hosting + OpenAI API)
4. **Local Heuristics:** Free (runs locally)

---

## Automated Testing Script

Run this in the browser console to test all scenarios programmatically:

```javascript
async function testAllScenarios() {
  const scenarios = [
    { enableChromeAI: true, byokEnabled: false, cloudAnalysis: false },
    { enableChromeAI: false, byokEnabled: true, cloudAnalysis: false, byokApiKey: 'sk-test' },
    { enableChromeAI: false, byokEnabled: false, cloudAnalysis: true },
    { enableChromeAI: false, byokEnabled: false, cloudAnalysis: false }
  ];

  for (const scenario of scenarios) {
    console.log('Testing:', scenario);
    await chrome.storage.sync.set(scenario);
    // Trigger analysis and verify results
    // (Implement based on your testing needs)
  }
}
```

---

## Reporting Issues

When reporting issues, include:

1. Chrome version: `chrome://version`
2. Extension version
3. Which analysis mode you were using
4. Browser console logs
5. Network tab screenshot (if relevant)
6. Steps to reproduce

---

**Happy Testing! 🧪**
