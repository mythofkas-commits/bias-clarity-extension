import { z } from 'zod';

// Language cue types
export const CueSchema = z.object({
  type: z.enum(['HEDGE', 'INTENSIFIER', 'AMBIGUOUS']),
  text: z.string(),
  span: z.tuple([z.number(), z.number()])
});

export type Cue = z.infer<typeof CueSchema>;

// Inference types
export const InferenceSchema = z.object({
  type: z.enum(['CORRELATION_TO_CAUSATION', 'ANECDOTE_TO_GENERALIZATION', 'PART_TO_WHOLE']),
  span: z.tuple([z.number(), z.number()]),
  explanation: z.string()
});

export type Inference = z.infer<typeof InferenceSchema>;

// Evidence types
export const EvidenceSchema = z.object({
  kind: z.enum(['URL', 'DOI', 'CITATION', 'NUMBER', 'DATE']),
  value: z.string(),
  meta: z.record(z.string()).optional(),
  span: z.tuple([z.number(), z.number()]).optional()
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// Claim structure
export const ClaimSchema = z.object({
  id: z.string(),
  paraphrase: z.string(),
  source_spans: z.array(z.tuple([z.number(), z.number()])),
  paraphrase_confidence: z.enum(['LLM', 'HEURISTIC'])
});

export type Claim = z.infer<typeof ClaimSchema>;

// Toulmin model structure
export const ToulminSchema = z.object({
  claimId: z.string(),
  premises: z.array(z.string()),
  warrant: z.string(),
  backing: z.string().optional()
});

export type Toulmin = z.infer<typeof ToulminSchema>;

// Chunk result structure
export const ClarifierChunkSchema = z.object({
  simplification: z.array(z.string()),
  conclusion_trace: z.string(),
  claims: z.array(ClaimSchema),
  toulmin: z.array(ToulminSchema),
  assumptions: z.array(z.string()),
  cues: z.array(CueSchema),
  inferences: z.array(InferenceSchema),
  evidence: z.array(EvidenceSchema),
  consider_questions: z.array(z.string())
});

export type ClarifierChunk = z.infer<typeof ClarifierChunkSchema>;

// Model metadata
export const ModelMetadataSchema = z.object({
  name: z.string(),
  mode: z.enum(['LLM', 'HEURISTIC']),
  token_usage: z.object({
    input: z.number(),
    output: z.number()
  }).optional()
});

export type ModelMetadata = z.infer<typeof ModelMetadataSchema>;

// Final document structure
export const ClarifierDocSchema = z.object({
  url: z.string(),
  hash: z.string(),
  merged: ClarifierChunkSchema,
  model: ModelMetadataSchema
});

export type ClarifierDoc = z.infer<typeof ClarifierDocSchema>;

// Request schema
export const AnalyzeRequestSchema = z.object({
  url: z.string().url(),
  text: z.string().max(120000)
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
