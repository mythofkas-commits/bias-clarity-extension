/**
 * Detect language cues in text (hedges, intensifiers, ambiguous quantifiers)
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

function findCues(text) {
  const cues = [];

  // Find hedges
  HEDGE_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      cues.push({
        type: 'HEDGE',
        text: match[0],
        span: [match.index, match.index + match[0].length]
      });
    }
  });

  // Find intensifiers
  INTENSIFIERS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      cues.push({
        type: 'INTENSIFIER',
        text: match[0],
        span: [match.index, match.index + match[0].length]
      });
    }
  });

  // Find ambiguous quantifiers
  AMBIGUOUS_QUANTIFIERS.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      cues.push({
        type: 'AMBIGUOUS',
        text: match[0],
        span: [match.index, match.index + match[0].length]
      });
    }
  });

  return cues;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findCues, HEDGE_WORDS, INTENSIFIERS, AMBIGUOUS_QUANTIFIERS };
}
