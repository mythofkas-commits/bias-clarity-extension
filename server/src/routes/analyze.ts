import { Router, Request, Response } from 'express';
import { AnalyzeRequestSchema, ClarifierDocSchema, ClarifierChunkSchema } from '../schema/clarifier';
import { hashText } from '../util/hash';
import { getCache, setCache } from '../cache/redis';
import { chunkText } from '../pipeline/chunk';
import { mergeChunks } from '../pipeline/merge';
import { runHeuristics } from '../pipeline/heuristics';
import { analyzeChunk } from '../llm/openai';

const router = Router();

/**
 * POST /analyze
 * Analyze text and return clarifier structure
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: parsed.error.issues 
      });
    }

    const { url, text } = parsed.data;
    const textHash = hashText(text);

    // Check cache
    const cached = await getCache(textHash);
    if (cached) {
      console.log(`Cache hit for hash: ${textHash}`);
      const cachedDoc = JSON.parse(cached);
      return res.json(cachedDoc);
    }

    console.log(`Cache miss for hash: ${textHash}. Processing...`);

    // Split text into chunks
    const chunks = chunkText(text, 4000);
    console.log(`Text split into ${chunks.length} chunk(s)`);

    let merged;
    let model;
    let totalTokens = { input: 0, output: 0 };

    try {
      // Try LLM analysis
      const analyzedChunks = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const { chunk, tokenUsage } = await analyzeChunk(chunks[i], i, chunks.length);
        
        // Validate chunk
        const validated = ClarifierChunkSchema.parse(chunk);
        analyzedChunks.push(validated);
        
        totalTokens.input += tokenUsage.input;
        totalTokens.output += tokenUsage.output;
      }

      // Merge chunks
      merged = mergeChunks(analyzedChunks);
      
      // Run heuristics to supplement
      const heuristicResult = runHeuristics(text);
      
      // Merge heuristic cues with LLM results (LLM takes precedence)
      if (merged.cues.length === 0) {
        merged.cues = heuristicResult.cues;
      }
      if (merged.inferences.length === 0) {
        merged.inferences = heuristicResult.inferences;
      }

      model = {
        name: 'gpt-4-turbo-preview',
        mode: 'LLM' as const,
        token_usage: totalTokens
      };

    } catch (error) {
      console.error('LLM analysis failed, falling back to heuristics:', error);
      
      // Fallback to heuristics only
      merged = runHeuristics(text);
      model = {
        name: 'heuristic-fallback',
        mode: 'HEURISTIC' as const
      };
    }

    // Create result document
    const result = {
      url,
      hash: textHash,
      merged,
      model
    };

    // Validate final result
    const validatedResult = ClarifierDocSchema.parse(result);

    // Cache result (7 days)
    await setCache(textHash, JSON.stringify(validatedResult), 604800);

    return res.json(validatedResult);

  } catch (error) {
    console.error('Error in /analyze:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
