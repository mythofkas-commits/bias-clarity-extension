/**
 * Tests for merge.ts
 */

import { mergeChunks } from '../server/src/pipeline/merge';
import type { ClarifierChunk } from '../server/src/schema/clarifier';

describe('mergeChunks', () => {
  it('should return empty result for empty array', () => {
    const result = mergeChunks([]);
    expect(result.claims).toEqual([]);
    expect(result.toulmin).toEqual([]);
    expect(result.assumptions).toEqual([]);
  });

  it('should return single chunk unchanged', () => {
    const chunk: ClarifierChunk = {
      claims: [{ id: 'c1', paraphrase: 'Test', source_spans: [[0, 4]], paraphrase_confidence: 'LLM' }],
      toulmin: [],
      assumptions: ['assumption1'],
      cues: [],
      inferences: [],
      evidence: [],
      consider_questions: []
    };

    const result = mergeChunks([chunk]);
    expect(result).toEqual(chunk);
  });

  it('should merge multiple chunks and deduplicate assumptions', () => {
    const chunk1: ClarifierChunk = {
      claims: [{ id: 'c1', paraphrase: 'Test1', source_spans: [[0, 5]], paraphrase_confidence: 'LLM' }],
      toulmin: [],
      assumptions: ['assumption1', 'assumption2'],
      cues: [],
      inferences: [],
      evidence: [],
      consider_questions: ['q1']
    };

    const chunk2: ClarifierChunk = {
      claims: [{ id: 'c2', paraphrase: 'Test2', source_spans: [[6, 11]], paraphrase_confidence: 'LLM' }],
      toulmin: [],
      assumptions: ['assumption2', 'assumption3'], // assumption2 is duplicate
      cues: [],
      inferences: [],
      evidence: [],
      consider_questions: ['q1', 'q2'] // q1 is duplicate
    };

    const result = mergeChunks([chunk1, chunk2]);
    
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].id).toBe('c1');
    expect(result.claims[1].id).toBe('c2');
    
    expect(result.assumptions).toHaveLength(3);
    expect(result.assumptions).toContain('assumption1');
    expect(result.assumptions).toContain('assumption2');
    expect(result.assumptions).toContain('assumption3');
    
    expect(result.consider_questions).toHaveLength(2);
    expect(result.consider_questions).toContain('q1');
    expect(result.consider_questions).toContain('q2');
  });

  it('should not duplicate claims with same ID', () => {
    const chunk1: ClarifierChunk = {
      claims: [{ id: 'c1', paraphrase: 'Test', source_spans: [[0, 4]], paraphrase_confidence: 'LLM' }],
      toulmin: [],
      assumptions: [],
      cues: [],
      inferences: [],
      evidence: [],
      consider_questions: []
    };

    const chunk2: ClarifierChunk = {
      claims: [{ id: 'c1', paraphrase: 'Test', source_spans: [[0, 4]], paraphrase_confidence: 'LLM' }],
      toulmin: [],
      assumptions: [],
      cues: [],
      inferences: [],
      evidence: [],
      consider_questions: []
    };

    const result = mergeChunks([chunk1, chunk2]);
    expect(result.claims).toHaveLength(1);
  });

  it('should preserve all cues and inferences with spans', () => {
    const chunk1: ClarifierChunk = {
      claims: [],
      toulmin: [],
      assumptions: [],
      cues: [{ type: 'HEDGE', text: 'maybe', span: [0, 5] }],
      inferences: [{ type: 'CORRELATION_TO_CAUSATION', span: [10, 20], explanation: 'test' }],
      evidence: [],
      consider_questions: []
    };

    const chunk2: ClarifierChunk = {
      claims: [],
      toulmin: [],
      assumptions: [],
      cues: [{ type: 'INTENSIFIER', text: 'definitely', span: [25, 35] }],
      inferences: [{ type: 'ANECDOTE_TO_GENERALIZATION', span: [40, 50], explanation: 'test2' }],
      evidence: [],
      consider_questions: []
    };

    const result = mergeChunks([chunk1, chunk2]);
    expect(result.cues).toHaveLength(2);
    expect(result.inferences).toHaveLength(2);
  });
});
