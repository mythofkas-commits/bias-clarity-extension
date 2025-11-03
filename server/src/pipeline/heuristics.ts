import type { ClarifierChunk, Cue, Inference, Evidence } from '../schema/clarifier';

/**
 * Heuristic patterns for language cues
 */
const HEDGE_WORDS = [
  'maybe', 'perhaps', 'possibly', 'might', 'could', 'may', 'seem', 'appear',
  'suggest', 'likely', 'probably', 'arguably', 'somewhat', 'relatively'
];

const INTENSIFIERS = [
  'very', 'extremely', 'definitely', 'certainly', 'absolutely', 'clearly',
  'obviously', 'undoubtedly', 'completely', 'totally', 'entirely', 'always',
  'never', 'all', 'none', 'must', 'proven', 'undeniable'
];

const AMBIGUOUS_QUANTIFIERS = [
  'many', 'some', 'few', 'several', 'most', 'often', 'rarely', 'seldom',
  'frequently', 'occasionally', 'numerous', 'a lot of', 'a number of'
];

/**
 * Inference patterns (basic heuristics)
 */
const CORRELATION_CAUSATION_PATTERNS = [
  /(\w+)\s+(?:is )?associated with\s+(\w+)/i,
  /(\w+)\s+(?:is )?correlated with\s+(\w+)/i,
  /(\w+)\s+and\s+(\w+)\s+(?:are )?linked/i,
  /studies show\s+(?:that\s+)?(\w+)/i
];

const ANECDOTE_PATTERNS = [
  /(?:I|we|my|our)\s+(?:know|knew|met|saw|experienced)/i,
  /(?:for example|instance),?\s+(?:I|we|my)/i,
  /(?:in my experience|personally)/i
];

const PART_WHOLE_PATTERNS = [
  /all\s+\w+\s+are/i,
  /every\s+\w+\s+(?:is|has)/i,
  /no\s+\w+\s+(?:is|has)/i
];

/**
 * Evidence patterns
 */
const URL_PATTERN = /https?:\/\/[^\s]+/g;
const DOI_PATTERN = /10\.\d{4,}\/[^\s]+/g;
const CITATION_PATTERN = /\([^)]*\d{4}[^)]*\)/g;
// const NUMBER_PATTERN = /\d+(?:[.,]\d+)*%?/g;  // Reserved for future use
// const DATE_PATTERN = /\b\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi;  // Reserved for future use

/**
 * Run heuristic analysis on text
 */
export function runHeuristics(text: string): ClarifierChunk {
  const cues = findLanguageCues(text);
  const inferences = findInferences(text);
  const evidence = findEvidence(text);
  
  // Extract basic claims (sentences with strong assertions)
  const claims = extractBasicClaims(text);
  
  // Generate basic assumptions
  const assumptions = generateAssumptions(text);
  
  // Generate questions
  const questions = generateQuestions(text);

  return {
    claims,
    toulmin: [], // Heuristics can't reliably extract Toulmin structure
    assumptions,
    cues,
    inferences,
    evidence,
    consider_questions: questions
  };
}

/**
 * Find language cues (hedges, intensifiers, ambiguous quantifiers)
 */
function findLanguageCues(text: string): Cue[] {
  const cues: Cue[] = [];

  // Find hedges
  for (const word of HEDGE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      cues.push({
        type: 'HEDGE',
        text: match[0],
        span: [match.index, match.index + match[0].length]
      });
    }
  }

  // Find intensifiers
  for (const word of INTENSIFIERS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      cues.push({
        type: 'INTENSIFIER',
        text: match[0],
        span: [match.index, match.index + match[0].length]
      });
    }
  }

  // Find ambiguous quantifiers
  for (const phrase of AMBIGUOUS_QUANTIFIERS) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      cues.push({
        type: 'AMBIGUOUS',
        text: match[0],
        span: [match.index, match.index + match[0].length]
      });
    }
  }

  return cues;
}

/**
 * Find logical inference issues
 */
function findInferences(text: string): Inference[] {
  const inferences: Inference[] = [];

  // Check for correlation→causation
  for (const pattern of CORRELATION_CAUSATION_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      inferences.push({
        type: 'CORRELATION_TO_CAUSATION',
        span: [match.index, match.index + match[0].length],
        explanation: 'Correlation is presented without establishing causation'
      });
    }
  }

  // Check for anecdote→generalization
  for (const pattern of ANECDOTE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      inferences.push({
        type: 'ANECDOTE_TO_GENERALIZATION',
        span: [match.index, match.index + match[0].length],
        explanation: 'Personal experience may not generalize to broader conclusions'
      });
    }
  }

  // Check for part→whole
  for (const pattern of PART_WHOLE_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      inferences.push({
        type: 'PART_TO_WHOLE',
        span: [match.index, match.index + match[0].length],
        explanation: 'Universal claim may not apply to all cases'
      });
    }
  }

  return inferences;
}

/**
 * Find evidence mentions
 */
function findEvidence(text: string): Evidence[] {
  const evidence: Evidence[] = [];

  // Find URLs
  let match;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    evidence.push({
      kind: 'URL',
      value: match[0],
      span: [match.index, match.index + match[0].length]
    });
  }

  // Find DOIs
  while ((match = DOI_PATTERN.exec(text)) !== null) {
    evidence.push({
      kind: 'DOI',
      value: match[0],
      span: [match.index, match.index + match[0].length]
    });
  }

  // Find citations
  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    evidence.push({
      kind: 'CITATION',
      value: match[0],
      span: [match.index, match.index + match[0].length]
    });
  }

  return evidence;
}

/**
 * Extract basic claims (heuristic: sentences with strong verbs)
 */
function extractBasicClaims(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const claims = [];
  
  for (let i = 0; i < Math.min(3, sentences.length); i++) {
    const sentence = sentences[i].trim();
    if (sentence) {
      const startIdx = text.indexOf(sentence);
      claims.push({
        id: `claim-${i + 1}`,
        paraphrase: sentence,
        source_spans: [[startIdx, startIdx + sentence.length]] as [number, number][],
        paraphrase_confidence: 'HEURISTIC' as const
      });
    }
  }
  
  return claims;
}

/**
 * Generate basic assumptions
 */
function generateAssumptions(text: string): string[] {
  const assumptions = [];
  
  if (text.toLowerCase().includes('should') || text.toLowerCase().includes('must')) {
    assumptions.push('The author assumes certain actions or outcomes are desirable or necessary');
  }
  
  if (text.match(/\b(?:we|people|everyone)\b/i)) {
    assumptions.push('The author assumes their perspective applies to a broader group');
  }
  
  return assumptions;
}

/**
 * Generate questions to consider
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateQuestions(_text: string): string[] {
  const questions = [
    'What evidence supports the main claims?',
    'Are there alternative explanations?',
    'What assumptions underlie the argument?'
  ];
  
  return questions;
}
