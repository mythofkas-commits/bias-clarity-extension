/**
 * Panel logic for Argument Clarifier
 */

let currentResults = null;
let currentText = '';

// Get API base from storage
async function getAPIBase() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiBase', 'cloudAnalysis'], (result) => {
      resolve({
        apiBase: result.apiBase || 'https://api.kasra.one',
        cloudAnalysis: result.cloudAnalysis !== false // Default to true
      });
    });
  });
}

// Extract text from the current tab
// Extract text from the current tab (returns actual text)
async function extractPageText() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return resolve({ url: '', text: '' });

      try {
        const [{ result: text }] = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // --- same logic as extractText.js, but returned directly ---
            const unwantedSelectors = 'script, style, noscript, iframe, nav, header, footer, aside, .advertisement, .ad, .comments';
            document.querySelectorAll(unwantedSelectors).forEach(el => el.remove());

            const picks = ['article','[role="main"]','main','.article-content','.post-content','.entry-content','#content'];
            let main = null;
            for (const sel of picks) {
              const el = document.querySelector(sel);
              if (el && (el.innerText || el.textContent).trim().length > 250) { main = el; break; }
            }
            if (!main) main = document.body;

            let t = (main.innerText || main.textContent || '').replace(/\s+/g, ' ').trim();
            if (t.length > 120000) t = t.slice(0, 120000); // keep under server max
            return t;
          }
        });

        resolve({ url: tabs[0].url, text: text || '' });
      } catch (e) {
        console.error('Error extracting text:', e);
        resolve({ url: tabs[0].url, text: '' });
      }
    });
  });
}

// Analyze text using backend or local heuristics
async function analyzeText(url, text) {
  const { apiBase, cloudAnalysis } = await getAPIBase();
  
  if (!cloudAnalysis) {
    // Use local heuristics only
    return runLocalAnalysis(url, text);
  }

  try {
    // Try cloud analysis
    const response = await fetch(`${apiBase}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, text })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    updateModeIndicator(data.model.mode, false);
    return data;

  } catch (error) {
    console.error('Cloud analysis failed:', error);
    updateModeIndicator('HEURISTIC', true);
    // Fallback to local analysis
    return runLocalAnalysis(url, text);
  }
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
  if (mode === 'LLM') {
    indicator.textContent = 'Analysis: GPT-powered';
    indicator.style.color = '#4CAF50';
  } else {
    indicator.textContent = isFallback 
      ? 'Local mode (server unreachable)' 
      : 'Local mode (reduced detail)';
    indicator.style.color = '#FF9800';
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
    
    let html = `<strong>Claim: ${structure.claimId}</strong>`;
    
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
