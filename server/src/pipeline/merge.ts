import type { ClarifierChunk } from '../schema/clarifier';

/**
 * Merge multiple chunks into a single result
 * Deduplicates and consolidates findings across chunks
 */
export function mergeChunks(chunks: ClarifierChunk[]): ClarifierChunk {
  if (chunks.length === 0) {
    return {
      simplification: [],
      conclusion_trace: '',
      claims: [],
      toulmin: [],
      assumptions: [],
      cues: [],
      inferences: [],
      evidence: [],
      consider_questions: []
    };
  }

  if (chunks.length === 1) {
    return chunks[0];
  }

  // Merge all arrays, removing duplicates where appropriate
  const merged: ClarifierChunk = {
    simplification: [],
    conclusion_trace: '',
    claims: [],
    toulmin: [],
    assumptions: [],
    cues: [],
    inferences: [],
    evidence: [],
    consider_questions: []
  };

  // Merge simplification and conclusion_trace
  const allSimplifications: string[] = [];
  const allTraces: string[] = [];
  for (const chunk of chunks) {
    allSimplifications.push(...chunk.simplification);
    allTraces.push(chunk.conclusion_trace);
  }
  merged.simplification = allSimplifications;
  merged.conclusion_trace = allTraces.join('\n\n---\n\n');

  // Merge claims (keep all with unique IDs)
  const claimIds = new Set<string>();
  for (const chunk of chunks) {
    for (const claim of chunk.claims) {
      if (!claimIds.has(claim.id)) {
        merged.claims.push(claim);
        claimIds.add(claim.id);
      }
    }
  }

  // Merge Toulmin structures
  for (const chunk of chunks) {
    merged.toulmin.push(...chunk.toulmin);
  }

  // Merge assumptions (deduplicate by content)
  const assumptionSet = new Set<string>();
  for (const chunk of chunks) {
    for (const assumption of chunk.assumptions) {
      assumptionSet.add(assumption);
    }
  }
  merged.assumptions = Array.from(assumptionSet);

  // Merge cues (keep all - spans are important)
  for (const chunk of chunks) {
    merged.cues.push(...chunk.cues);
  }

  // Merge inferences (keep all - spans are important)
  for (const chunk of chunks) {
    merged.inferences.push(...chunk.inferences);
  }

  // Merge evidence (deduplicate by value)
  const evidenceMap = new Map<string, typeof merged.evidence[0]>();
  for (const chunk of chunks) {
    for (const ev of chunk.evidence) {
      if (!evidenceMap.has(ev.value)) {
        evidenceMap.set(ev.value, ev);
      }
    }
  }
  merged.evidence = Array.from(evidenceMap.values());

  // Merge questions (deduplicate)
  const questionSet = new Set<string>();
  for (const chunk of chunks) {
    for (const question of chunk.consider_questions) {
      questionSet.add(question);
    }
  }
  merged.consider_questions = Array.from(questionSet);

  return merged;
}
