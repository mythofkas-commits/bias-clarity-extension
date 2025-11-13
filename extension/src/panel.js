/**
 * Panel logic for Argument Clarifier
 */

let currentResults = null;
let currentText = '';

// Fetch with timeout helper
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...fetchOptions, signal: controller.signal });
    return response;
  } catch (error) {
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    if (!(error instanceof Error)) {
      throw new Error(String(error));
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

// Get settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'apiBase',
      'cloudAnalysis',
      'enableChromeAI',
      'byokEnabled',
      'byokApiKey',
      'byokProvider'
    ], (result) => {
      resolve({
        apiBase: result.apiBase || 'https://api.kasra.one',
        cloudAnalysis: result.cloudAnalysis !== false, // Default to true
        enableChromeAI: result.enableChromeAI !== false, // Default to true
        byokEnabled: result.byokEnabled || false,
        byokApiKey: result.byokApiKey || '',
        byokProvider: result.byokProvider || 'openai'
      });
    });
  });
}

// Legacy alias for backward compatibility
async function getAPIBase() {
  const settings = await getSettings();
  return {
    apiBase: settings.apiBase,
    cloudAnalysis: settings.cloudAnalysis
  };
}

// Extract text from the current tab
async function extractPageText() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        resolve({ url: '', text: '' });
        return;
      }
      try {
        // First, inject the extractor (isolated world)
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['src/heuristics/extractText.js']
        });
        // Then, call extractText() and return its value
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            try {
              if (typeof extractText === 'function') {
                return extractText();
              }
              // Safety fallback
              const raw = (document.body && document.body.innerText) || document.documentElement.innerText || '';
              return (raw || '').slice(0, 120000);
            } catch (e) {
              return '';
            }
          }
        });
        const text = results && results[0] ? (results[0].result || '') : '';
        resolve({ url: tabs[0].url, text });
      } catch (error) {
        console.error('Error extracting text:', error);
        resolve({ url: tabs[0].url, text: '' });
      }
    });
  });
}

// Analyze text using hybrid priority fallback system
async function analyzeText(url, text) {
  const settings = await getSettings();
  const attempts = [];

  // Priority 1: Chrome Built-in AI (free, private, fast)
  if (settings.enableChromeAI) {
    try {
      const chromeAICheck = await checkChromeAI();
      if (chromeAICheck.available) {
        console.log('[Argument Clarifier] Attempting Chrome Built-in AI...');
        const result = await analyzeChromeAI(url, text);
        updateModeIndicator('CHROME_AI', false);
        console.log('[Argument Clarifier] Chrome AI analysis successful');
        return result;
      } else {
        attempts.push(`Chrome AI unavailable: ${chromeAICheck.reason}`);
        console.log(`[Argument Clarifier] ${chromeAICheck.reason}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      attempts.push(`Chrome AI failed: ${errorMsg}`);
      console.warn('[Argument Clarifier] Chrome AI analysis failed:', error);
    }
  }

  // Priority 2: BYOK (Bring Your Own Key)
  if (settings.byokEnabled && settings.byokApiKey) {
    try {
      console.log('[Argument Clarifier] Attempting BYOK analysis...');
      const result = await analyzeWithBYOK(url, text, settings.byokApiKey, settings.byokProvider);
      updateModeIndicator('BYOK', false);
      console.log('[Argument Clarifier] BYOK analysis successful');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      attempts.push(`BYOK failed: ${errorMsg}`);
      console.warn('[Argument Clarifier] BYOK analysis failed:', error);
    }
  }

  // Priority 3: Cloud service (your hosted API)
  if (settings.cloudAnalysis) {
    try {
      console.log('[Argument Clarifier] Attempting cloud service...');
      const response = await fetchWithTimeout(`${settings.apiBase}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, text })
      });

      if (!response.ok) {
        let detail = '';
        const contentType = response.headers.get('content-type') || '';
        try {
          if (contentType.includes('application/json')) {
            const errorJson = await response.clone().json();
            const extracted = errorJson && (errorJson.error || errorJson.message);
            detail = extracted || JSON.stringify(errorJson);
          } else {
            const textResponse = await response.clone().text();
            detail = textResponse.trim();
          }
        } catch (parseError) {
          console.debug('[Argument Clarifier] Failed to parse error response body:', parseError);
        }

        const statusText = response.statusText ? ` ${response.statusText}` : '';
        const normalizedDetail = detail && detail !== '{}' && detail !== 'null' ? detail : '';
        const detailSuffix = normalizedDetail ? ` – ${normalizedDetail.slice(0, 250)}` : '';
        throw new Error(`Server error: ${response.status}${statusText}${detailSuffix}`);
      }

      const data = await response.json();
      console.log('[Argument Clarifier] Cloud analysis successful');
      updateModeIndicator(data.model.mode, false);
      return data;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      attempts.push(`Cloud service failed: ${errorMsg}`);
      console.warn('[Argument Clarifier] Cloud analysis failed:', error);
    }
  }

  // Priority 4: Local heuristics (always available)
  console.log('[Argument Clarifier] Falling back to local heuristics');
  if (attempts.length > 0) {
    console.log('[Argument Clarifier] Previous attempts:', attempts.join('; '));
  }
  updateModeIndicator('HEURISTIC', true);
  return runLocalAnalysis(url, text);
}

// Analyze using user's own API key (BYOK)
async function analyzeWithBYOK(url, text, apiKey, provider = 'openai') {
  if (provider !== 'openai') {
    throw new Error(`Provider ${provider} not yet supported`);
  }

  // Call OpenAI API directly from extension
  // Security note: API key is sent from browser extension and visible in DevTools/network logs.
  // This is a trade-off for BYOK functionality. Users should be aware their key is exposed client-side.
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You analyze argument structure without judging truth. Return valid JSON only.'
        },
        {
          role: 'user',
          content: `Analyze this text and return JSON with: claims (array of {id, paraphrase, confidence}), assumptions (array of strings), cues (array of {text, type: "HEDGE"|"INTENSIFIER"|"AMBIGUOUS"}), inferences (array of {type, explanation}), evidence (array of {kind, value}), consider_questions (array of strings), simplification (array of strings), conclusion_trace (string).

Text: ${text.slice(0, 30000)}`
        }
      ]
    })
  });

  if (!response.ok) {
    let errorMessage = '';
    // Clone the response so we can read the body twice if needed
    const clonedResponse = response.clone();
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || JSON.stringify(errorData);
    } catch (jsonErr) {
      try {
        const errorText = await clonedResponse.text();
        errorMessage = `Non-JSON error response: ${errorText}`;
      } catch (textErr) {
        errorMessage = `Failed to parse error response: ${jsonErr.message}`;
      }
    }
    throw new Error(`OpenAI API error: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid OpenAI response structure');
  }
  const analysis = JSON.parse(data.choices[0].message.content);

  // Transform to clarifier format
  return {
    url,
    hash: 'byok',
    merged: {
      claims: (analysis.claims || []).map((c, i) => ({
        id: c.id || `claim-${i + 1}`,
        paraphrase: c.paraphrase,
        source_spans: [[0, 0]],
        paraphrase_confidence: c.confidence || 'MEDIUM'
      })),
      toulmin: analysis.toulmin || [],
      assumptions: analysis.assumptions || [],
      cues: (analysis.cues || []).map(c => ({
        text: c.text,
        type: c.type,
        span: [0, c.text.length]
      })),
      inferences: (analysis.inferences || []).map(inf => ({
        type: inf.type,
        explanation: inf.explanation,
        span: [0, 0]
      })),
      evidence: analysis.evidence || [],
      consider_questions: analysis.consider_questions || [],
      simplification: analysis.simplification || [],
      conclusion_trace: analysis.conclusion_trace || ''
    },
    model: {
      name: 'gpt-4-turbo-byok',
      mode: 'BYOK',
      token_usage: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0
      }
    }
  };
}

// Run local heuristics analysis
function runLocalAnalysis(url, text) {
  const cues = typeof findCues !== 'undefined' ? findCues(text) : [];
  const inferences = typeof findInferences !== 'undefined' ? findInferences(text) : [];
  
  // Basic claim extraction (first few sentences)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const claims = sentences.slice(0, 3).map((sentence, i) => {
    const trimmed = sentence.trim();
    const startIdx = text.indexOf(trimmed);
    return {
      id: `claim-${i + 1}`,
      paraphrase: trimmed,
      source_spans: [[startIdx, startIdx + trimmed.length]],
      paraphrase_confidence: 'HEURISTIC'
    };
  });

  return {
    url,
    hash: 'local',
    merged: {
      claims,
      toulmin: [],
      assumptions: [
        'Local analysis provides limited insight',
        'Enable cloud analysis for detailed argument structure'
      ],
      cues,
      inferences,
      evidence: [],
      consider_questions: [
        'What evidence supports the claims?',
        'Are there alternative explanations?',
        'What assumptions underlie the argument?'
      ]
    },
    model: {
      name: 'local-heuristics',
      mode: 'HEURISTIC'
    }
  };
}

// Update mode indicator
function updateModeIndicator(mode, isFallback) {
  const indicator = document.getElementById('mode-text');

  switch (mode) {
  case 'CHROME_AI':
    indicator.textContent = '✓ Chrome Built-in AI (private, local)';
    indicator.style.color = '#4CAF50';
    indicator.title = 'Analysis performed locally using Chrome\'s Built-in AI';
    break;

  case 'BYOK':
    indicator.textContent = '✓ Your API Key (custom)';
    indicator.style.color = '#2196F3';
    indicator.title = 'Analysis using your personal API key';
    break;

  case 'LLM':
    indicator.textContent = '✓ Cloud Analysis (GPT-4)';
    indicator.style.color = '#4CAF50';
    indicator.title = 'Analysis from hosted cloud service';
    break;

  case 'HEURISTIC':
    indicator.textContent = isFallback
      ? '⚠ Local Heuristics (fallback)'
      : 'Local Heuristics (limited)';
    indicator.style.color = '#FF9800';
    indicator.title = 'Basic pattern matching - enable Chrome AI or cloud for better results';
    break;

  default:
    indicator.textContent = 'Analysis: ' + mode;
    indicator.style.color = '#666';
  }
}

// Render results
function renderResults(data) {
  currentResults = data;
  const merged = data.merged;

  // Show results section
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');

  // Render new sections
  renderSimplification(merged.simplification);
  renderConclusionTrace(merged.conclusion_trace);

  // Render claims
  renderClaims(merged.claims);

  // Render Toulmin structures
  renderToulmin(merged.toulmin);

  // Render assumptions
  renderAssumptions(merged.assumptions);

  // Render cues
  renderCues(merged.cues);

  // Render inferences
  renderInferences(merged.inferences);

  // Render evidence
  renderEvidence(merged.evidence);

  // Render questions
  renderQuestions(merged.consider_questions);

  // Update confidence text
  const confidenceText = document.getElementById('confidence-text');
  confidenceText.textContent = `Paraphrase confidence: ${data.model.mode}`;
  
  if (data.model.token_usage) {
    confidenceText.textContent += ` | Tokens: ${data.model.token_usage.input} in, ${data.model.token_usage.output} out`;
  }
}

// Render Simplification
function renderSimplification(simplification) {
  const container = document.getElementById('simplification-list');
  const section = document.getElementById('simplification-section');
  container.innerHTML = '';

  if (!simplification || simplification.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  simplification.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

// Render Conclusion Trace
function renderConclusionTrace(trace) {
  const container = document.getElementById('conclusion-trace-text');
  const section = document.getElementById('conclusion-trace-section');

  if (!trace || trace.trim().length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.textContent = trace;
}

// Render claims
function renderClaims(claims) {
  const container = document.getElementById('claims-list');
  container.innerHTML = '';

  if (!claims || claims.length === 0) {
    container.innerHTML = '<p class="empty-state">No claims identified</p>';
    return;
  }

  claims.forEach(claim => {
    const div = document.createElement('div');
    div.className = 'claim-item';
    div.innerHTML = `
      <div class="claim-id">${claim.id}</div>
      <div class="claim-text">${escapeHtml(claim.paraphrase)}</div>
      <div class="claim-confidence">Confidence: ${claim.paraphrase_confidence}</div>
    `;
    container.appendChild(div);
  });
}

// Render Toulmin structures
function renderToulmin(toulmin) {
  const container = document.getElementById('toulmin-list');
  container.innerHTML = '';

  if (!toulmin || toulmin.length === 0) {
    container.innerHTML = '<p class="empty-state">No argument structure identified</p>';
    return;
  }

  toulmin.forEach(structure => {
    const div = document.createElement('div');
    div.className = 'toulmin-item';
    
    let html = `<strong>Claim: ${escapeHtml(String(structure.claimId))}</strong>`;
    
    if (structure.premises && structure.premises.length > 0) {
      html += '<div class="toulmin-premises"><strong>Premises:</strong><ul>';
      structure.premises.forEach(premise => {
        html += `<li>${escapeHtml(premise)}</li>`;
      });
      html += '</ul></div>';
    }
    
    if (structure.warrant) {
      html += `<div class="toulmin-warrant"><strong>Warrant:</strong> ${escapeHtml(structure.warrant)}</div>`;
    }
    
    if (structure.backing) {
      html += `<div style="margin-top: 10px;"><strong>Backing:</strong> ${escapeHtml(structure.backing)}</div>`;
    }
    
    div.innerHTML = html;
    container.appendChild(div);
  });
}

// Render assumptions
function renderAssumptions(assumptions) {
  const container = document.getElementById('assumptions-list');
  container.innerHTML = '';

  if (!assumptions || assumptions.length === 0) {
    container.innerHTML = '<li class="empty-state">No assumptions identified</li>';
    return;
  }

  assumptions.forEach(assumption => {
    const li = document.createElement('li');
    li.textContent = assumption;
    container.appendChild(li);
  });
}

// Render cues
function renderCues(cues) {
  const container = document.getElementById('cues-list');
  container.innerHTML = '';

  if (!cues || cues.length === 0) {
    container.innerHTML = '<p class="empty-state">No language cues found</p>';
    return;
  }

  // Group by type
  const grouped = { HEDGE: [], INTENSIFIER: [], AMBIGUOUS: [] };
  cues.forEach(cue => {
    if (grouped[cue.type]) {
      grouped[cue.type].push(cue);
    }
  });

  Object.entries(grouped).forEach(([type, items]) => {
    if (items.length > 0) {
      const section = document.createElement('div');
      section.style.marginBottom = '15px';
      
      const title = document.createElement('strong');
      title.textContent = `${type.charAt(0) + type.slice(1).toLowerCase()}s (${items.length}): `;
      section.appendChild(title);
      
      items.forEach(item => {
        const span = document.createElement('span');
        span.className = `cue-item ${type}`;
        span.textContent = item.text;
        span.title = `Position: ${item.span[0]}-${item.span[1]}`;
        section.appendChild(span);
      });
      
      container.appendChild(section);
    }
  });
}

// Render inferences
function renderInferences(inferences) {
  const container = document.getElementById('inferences-list');
  container.innerHTML = '';

  if (!inferences || inferences.length === 0) {
    container.innerHTML = '<p class="empty-state">No logical inference issues detected</p>';
    return;
  }

  inferences.forEach(inference => {
    const div = document.createElement('div');
    div.className = 'inference-item';
    
    const typeName = inference.type.replace(/_/g, ' → ');
    div.innerHTML = `
      <div class="inference-type">${typeName}</div>
      <div class="inference-explanation">${escapeHtml(inference.explanation)}</div>
      <div style="font-size: 11px; color: #999; margin-top: 5px;">Position: ${inference.span[0]}-${inference.span[1]}</div>
    `;
    container.appendChild(div);
  });
}

// Render evidence
function renderEvidence(evidence) {
  const container = document.getElementById('evidence-list');
  container.innerHTML = '';

  if (!evidence || evidence.length === 0) {
    container.innerHTML = '<p class="empty-state">No evidence citations found</p>';
    return;
  }

  evidence.forEach(ev => {
    const div = document.createElement('div');
    div.className = 'evidence-item';
    div.innerHTML = `
      <div class="evidence-kind">${ev.kind}</div>
      <div class="evidence-value">${escapeHtml(ev.value)}</div>
    `;
    container.appendChild(div);
  });
}

// Render questions
function renderQuestions(questions) {
  const container = document.getElementById('questions-list');
  container.innerHTML = '';

  if (!questions || questions.length === 0) {
    container.innerHTML = '<li class="empty-state">No questions generated</li>';
    return;
  }

  questions.forEach(question => {
    const li = document.createElement('li');
    li.textContent = question;
    container.appendChild(li);
  });
}

// Show error
function showError(message) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('error').classList.remove('hidden');
  document.querySelector('.error-message').textContent = message;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Main analyze function
async function analyze() {
  document.getElementById('analyze-btn').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');

  try {
    // Extract text from current page
    const { url, text } = await extractPageText();
    currentText = text;

    if (!text || text.trim().length < 50) {
      showError('Not enough text content found on this page');
      return;
    }

    // Analyze
    const results = await analyzeText(url, text);
    renderResults(results);

  } catch (error) {
    console.error('Analysis error:', error);
    showError('Analysis failed: ' + error.message);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('analyze-btn').addEventListener('click', analyze);
  document.getElementById('retry-btn').addEventListener('click', analyze);
});
