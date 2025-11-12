/**
 * Chrome Built-in AI integration for Argument Clarifier
 * Uses Chrome's experimental Prompt API for local, privacy-preserving analysis
 * Documentation: https://developer.chrome.com/docs/ai/built-in
 */

/**
 * Check if Chrome Built-in AI is available
 * @returns {Promise<{available: boolean, reason?: string}>}
 */
async function checkChromeAI() {
  try {
    // Check if the API exists
    if (!window.ai || !window.ai.languageModel) {
      return {
        available: false,
        reason: 'Chrome Built-in AI not supported (requires Chrome 127+)'
      };
    }

    // Check availability status
    const status = await window.ai.languageModel.capabilities();

    if (status.available === 'readily') {
      return { available: true };
    } else if (status.available === 'after-download') {
      return {
        available: false,
        reason: 'AI model needs to be downloaded first'
      };
    } else {
      return {
        available: false,
        reason: `AI not available: ${status.available}`
      };
    }
  } catch (error) {
    return {
      available: false,
      reason: `Error checking AI: ${error.message}`
    };
  }
}

/**
 * Analyze text using Chrome Built-in AI
 * @param {string} url - The URL of the page
 * @param {string} text - The text to analyze
 * @returns {Promise<Object>} Analysis results in clarifier format
 */
async function analyzeChromeAI(url, text) {
  // Create AI session
  const session = await window.ai.languageModel.create({
    temperature: 0.3,  // Lower temperature for more consistent analysis
    topK: 5
  });

  try {
    // Truncate text if too long (Chrome AI has limits)
    const maxLength = 8000;  // Conservative limit
    const truncatedText = text.length > maxLength
      ? text.slice(0, maxLength) + '...[truncated]'
      : text;

    // Create analysis prompt
    const prompt = `You are analyzing argument structure. Your task is to identify claims, reasoning patterns, and language cues in the following text. Do NOT judge truth or validity.

Text to analyze:
"""
${truncatedText}
"""

Please provide a JSON response with this structure:
{
  "claims": [{"id": "claim-1", "paraphrase": "main assertion", "confidence": "MEDIUM"}],
  "assumptions": ["unstated belief 1", "unstated belief 2"],
  "cues": [{"text": "maybe", "type": "HEDGE", "position": 123}],
  "inferences": [{"type": "correlation_causation", "explanation": "assumes X causes Y"}],
  "evidence": [{"kind": "URL", "value": "http://example.com"}],
  "questions": ["What evidence supports this?", "Are there alternatives?"]
}

Focus on:
- Main claims (3-5 key assertions)
- Hidden assumptions underlying arguments
- Language cues: hedges (maybe, perhaps), intensifiers (definitely, clearly), ambiguous quantifiers (many, some)
- Potential logical issues: correlation→causation, anecdote→generalization
- Evidence: citations, URLs, numbers, dates
- Critical thinking questions

Respond ONLY with valid JSON, no other text.`;

    // Get AI response
    const response = await session.prompt(prompt);

    // Parse JSON response
    let analysis;
    try {
      // Extract JSON from response (in case AI adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Chrome AI response:', parseError);
      console.debug('Raw response:', response);
      throw new Error('Chrome AI returned invalid format');
    }

    // Transform to clarifier format
    const result = {
      url,
      hash: 'chrome-ai',
      merged: {
        claims: formatClaims(analysis.claims || []),
        toulmin: [], // Chrome AI might not generate this
        assumptions: analysis.assumptions || [],
        cues: formatCues(analysis.cues || []),
        inferences: formatInferences(analysis.inferences || []),
        evidence: formatEvidence(analysis.evidence || []),
        consider_questions: analysis.questions || [],
        simplification: analysis.simplification || [],
        conclusion_trace: analysis.conclusion_trace || ''
      },
      model: {
        name: 'chrome-builtin-gemini-nano',
        mode: 'CHROME_AI'
      }
    };

    return result;

  } finally {
    // Clean up session
    await session.destroy();
  }
}

/**
 * Format claims to match expected schema
 */
function formatClaims(claims) {
  return claims.map((claim, index) => ({
    id: claim.id || `claim-${index + 1}`,
    paraphrase: claim.paraphrase || claim.text || String(claim),
    source_spans: [[0, 0]], // Chrome AI doesn't provide exact positions
    paraphrase_confidence: claim.confidence || 'MEDIUM'
  }));
}

/**
 * Format cues to match expected schema
 */
function formatCues(cues) {
  return cues.map(cue => ({
    text: cue.text,
    type: cue.type || 'HEDGE',
    span: [cue.position || 0, (cue.position || 0) + cue.text.length]
  }));
}

/**
 * Format inferences to match expected schema
 */
function formatInferences(inferences) {
  return inferences.map(inf => ({
    type: inf.type || 'unknown',
    explanation: inf.explanation || String(inf),
    span: [0, 0]
  }));
}

/**
 * Format evidence to match expected schema
 */
function formatEvidence(evidence) {
  return evidence.map(ev => ({
    kind: ev.kind || 'CITATION',
    value: ev.value || String(ev)
  }));
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkChromeAI, analyzeChromeAI };
}
