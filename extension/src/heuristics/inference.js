/**
 * Detect logical inference issues
 */

function findInferences(text) {
  const inferences = [];

  // Correlation to causation patterns
  const correlationPatterns = [
    /(\w+)\s+(?:is )?associated with\s+(\w+)/gi,
    /(\w+)\s+(?:is )?correlated with\s+(\w+)/gi,
    /(\w+)\s+and\s+(\w+)\s+(?:are )?linked/gi,
    /studies show\s+(?:that\s+)?(\w+)/gi
  ];

  correlationPatterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      inferences.push({
        type: 'CORRELATION_TO_CAUSATION',
        span: [match.index, match.index + match[0].length],
        explanation: 'Correlation is presented without establishing causation'
      });
    }
  });

  // Anecdote to generalization patterns
  const anecdotePatterns = [
    /(?:I|we|my|our)\s+(?:know|knew|met|saw|experienced)/gi,
    /(?:for example|instance),?\s+(?:I|we|my)/gi,
    /(?:in my experience|personally)/gi
  ];

  anecdotePatterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      inferences.push({
        type: 'ANECDOTE_TO_GENERALIZATION',
        span: [match.index, match.index + match[0].length],
        explanation: 'Personal experience may not generalize to broader conclusions'
      });
    }
  });

  // Part to whole patterns
  const partWholePatterns = [
    /all\s+\w+\s+are/gi,
    /every\s+\w+\s+(?:is|has)/gi,
    /no\s+\w+\s+(?:is|has)/gi
  ];

  partWholePatterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      inferences.push({
        type: 'PART_TO_WHOLE',
        span: [match.index, match.index + match[0].length],
        explanation: 'Universal claim may not apply to all cases'
      });
    }
  });

  return inferences;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findInferences };
}
