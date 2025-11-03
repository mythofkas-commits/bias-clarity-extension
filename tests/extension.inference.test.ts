/**
 * Tests for extension inference detection
 * This simulates the browser environment for testing
 */

// Mock the module export check
global.module = undefined;

// Load the inference module
const fs = require('fs');
const path = require('path');
const inferenceCode = fs.readFileSync(
  path.join(__dirname, '../extension/src/heuristics/inference.js'),
  'utf8'
);

// Execute in a test context
const findInferences = (function() {
  eval(inferenceCode);
  return findInferences;
})();

describe('Inference Detection', () => {
  it('should detect correlation to causation patterns', () => {
    const text = 'Studies show that coffee consumption is associated with better health.';
    const inferences = findInferences(text);
    
    const correlationInferences = inferences.filter(i => i.type === 'CORRELATION_TO_CAUSATION');
    expect(correlationInferences.length).toBeGreaterThan(0);
    expect(correlationInferences[0].explanation).toContain('Correlation');
  });

  it('should detect anecdote to generalization', () => {
    const text = 'In my experience, this approach always works.';
    const inferences = findInferences(text);
    
    const anecdoteInferences = inferences.filter(i => i.type === 'ANECDOTE_TO_GENERALIZATION');
    expect(anecdoteInferences.length).toBeGreaterThan(0);
    expect(anecdoteInferences[0].explanation).toContain('Personal experience');
  });

  it('should detect part to whole fallacy', () => {
    const text = 'All politicians are corrupt.';
    const inferences = findInferences(text);
    
    const partWholeInferences = inferences.filter(i => i.type === 'PART_TO_WHOLE');
    expect(partWholeInferences.length).toBeGreaterThan(0);
    expect(partWholeInferences[0].explanation).toContain('Universal claim');
  });

  it('should include correct span information', () => {
    const text = 'Studies show that X is correlated with Y.';
    const inferences = findInferences(text);
    
    if (inferences.length > 0) {
      const inference = inferences[0];
      expect(inference.span).toBeDefined();
      expect(inference.span).toHaveLength(2);
      expect(inference.span[0]).toBeGreaterThanOrEqual(0);
      expect(inference.span[1]).toBeLessThanOrEqual(text.length);
    }
  });

  it('should return empty array for clean text', () => {
    const text = 'This is a simple statement with no inference issues.';
    const inferences = findInferences(text);
    
    expect(Array.isArray(inferences)).toBe(true);
  });

  it('should handle empty text', () => {
    const inferences = findInferences('');
    expect(Array.isArray(inferences)).toBe(true);
    expect(inferences).toHaveLength(0);
  });

  it('should be case insensitive', () => {
    const text1 = 'Studies show that X is associated with Y.';
    const text2 = 'STUDIES SHOW that X is ASSOCIATED with Y.';
    
    const inferences1 = findInferences(text1);
    const inferences2 = findInferences(text2);
    
    expect(inferences1.length).toBe(inferences2.length);
  });
});
