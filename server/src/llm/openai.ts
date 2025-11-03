import OpenAI from 'openai';
import type { ClarifierChunk } from '../schema/clarifier';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client
 */
export function initOpenAI(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  openaiClient = new OpenAI({
    apiKey: apiKey
  });

  return openaiClient;
}

/**
 * Analyze text chunk using GPT with strict JSON mode
 */
export async function analyzeChunk(
  text: string,
  chunkIndex: number,
  totalChunks: number
): Promise<{ chunk: ClarifierChunk; tokenUsage: { input: number; output: number } }> {
  const client = initOpenAI();

  const systemPrompt = `You are an argument analysis expert. Analyze the given text and extract:
1. Claims: Main assertions made (with source spans)
2. Toulmin structure: For each claim, identify premises, warrants, and backing
3. Assumptions: Unstated beliefs required for arguments to hold
4. Language cues: Hedges (maybe, perhaps), intensifiers (definitely, clearly), ambiguous quantifiers (many, some)
5. Logical inferences: Identify fallacies like correlation→causation, anecdote→generalization, part→whole
6. Evidence: URLs, DOIs, citations, numbers, dates with spans
7. Questions to consider: What should readers think about?

Return valid JSON matching the ClarifierChunk schema. Use character offsets for spans.`;

  const userPrompt = `Analyze this text (chunk ${chunkIndex + 1}/${totalChunks}):\n\n${text}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      seed: 42,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT response');
    }

    const parsed = JSON.parse(content);
    
    // Ensure all required fields exist with defaults
    const chunk: ClarifierChunk = {
      claims: parsed.claims || [],
      toulmin: parsed.toulmin || [],
      assumptions: parsed.assumptions || [],
      cues: parsed.cues || [],
      inferences: parsed.inferences || [],
      evidence: parsed.evidence || [],
      consider_questions: parsed.consider_questions || []
    };

    const tokenUsage = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0
    };

    console.log(`Chunk ${chunkIndex + 1}/${totalChunks} analyzed. Tokens: ${tokenUsage.input} in, ${tokenUsage.output} out`);

    return { chunk, tokenUsage };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}
