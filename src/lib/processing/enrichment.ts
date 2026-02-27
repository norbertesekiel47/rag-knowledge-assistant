import Groq from "groq-sdk";
import type {
  PreEnrichmentChunk,
  EnrichedChunk,
  EnrichmentOptions,
} from "./types";
import { logger } from "@/lib/utils/logger";

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_BATCH_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const ENRICHMENT_MODEL = "llama-3.1-8b-instant";

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (groqClient) return groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable");
  }

  groqClient = new Groq({ apiKey });
  return groqClient;
}

interface ChunkMetadata {
  summary: string;
  keywords: string[];
  hypotheticalQuestions: string[];
}

/**
 * Generate metadata for a single chunk using Groq LLM.
 * Returns summary, keywords, and hypothetical questions (HyDE).
 */
async function generateChunkMetadata(
  chunk: PreEnrichmentChunk,
  filename: string
): Promise<ChunkMetadata> {
  const client = getGroqClient();

  const contentPreview = chunk.content.length > 1500
    ? chunk.content.slice(0, 1500) + "..."
    : chunk.content;

  const prompt = `Given the following text chunk from a document titled "${filename}" under section "${chunk.sectionTitle}":

---
${contentPreview}
---

Respond with valid JSON only (no markdown, no code fences):
{
  "summary": "A 1-2 sentence concise summary of what this chunk contains",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "hypotheticalQuestions": ["question1", "question2", "question3"]
}

Rules:
- summary: Describe what information this chunk provides in 1-2 sentences.
- keywords: Extract 3-8 key terms or concepts from this text.
- hypotheticalQuestions: Generate exactly 3 natural questions a user might ask that this chunk could answer.
- Respond ONLY with the JSON object, nothing else.`;

  const response = await client.chat.completions.create({
    model: ENRICHMENT_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a metadata extraction assistant. You always respond with valid JSON only. No explanations, no markdown formatting.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });

  const rawContent = response.choices[0]?.message?.content?.trim() || "";

  return parseMetadataResponse(rawContent);
}

/**
 * Parse the LLM response into structured metadata.
 * Handles edge cases like markdown fences, extra text, etc.
 */
function parseMetadataResponse(raw: string): ChunkMetadata {
  const fallback: ChunkMetadata = {
    summary: "",
    keywords: [],
    hypotheticalQuestions: [],
  };

  if (!raw) return fallback;

  // Strip markdown code fences if present
  let cleaned = raw;
  cleaned = cleaned.replace(/^```(?:json)?\n?/i, "");
  cleaned = cleaned.replace(/\n?```$/i, "");
  cleaned = cleaned.trim();

  // Try to extract JSON from the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k: unknown) => typeof k === "string").slice(0, 8)
        : [],
      hypotheticalQuestions: Array.isArray(parsed.hypotheticalQuestions)
        ? parsed.hypotheticalQuestions.filter((q: unknown) => typeof q === "string").slice(0, 3)
        : [],
    };
  } catch {
    return fallback;
  }
}

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enrich a single chunk with retry logic and exponential backoff.
 */
async function enrichChunkWithRetry(
  chunk: PreEnrichmentChunk,
  filename: string
): Promise<ChunkMetadata> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateChunkMetadata(chunk, filename);
    } catch (error) {
      const isRateLimit = error instanceof Error &&
        (error.message.includes("429") || error.message.includes("rate_limit"));

      if (attempt === MAX_RETRIES) {
        logger.error(
          `Enrichment failed for chunk ${chunk.chunkIndex} after ${MAX_RETRIES} attempts`,
          "enrichment",
          { error: error instanceof Error ? { message: error.message } : { error: String(error) } }
        );
        // Return empty metadata rather than failing the entire document
        return { summary: "", keywords: [], hypotheticalQuestions: [] };
      }

      // Exponential backoff: 2s, 4s, 8s
      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.warn(
        `Enrichment attempt ${attempt} failed for chunk ${chunk.chunkIndex}${isRateLimit ? " (rate limited)" : ""}, retrying in ${backoffMs}ms...`,
        "enrichment"
      );
      await delay(backoffMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  return { summary: "", keywords: [], hypotheticalQuestions: [] };
}

/**
 * Enrich an array of chunks with LLM-generated metadata.
 * Processes in batches with delays to avoid rate limits.
 *
 * If skipEnrichment is true, returns chunks with empty metadata fields
 * (useful for testing the pipeline without LLM calls).
 */
export async function enrichChunks(
  chunks: PreEnrichmentChunk[],
  filename: string,
  options?: EnrichmentOptions
): Promise<EnrichedChunk[]> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const batchDelayMs = options?.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS;
  const skipEnrichment = options?.skipEnrichment ?? false;

  if (skipEnrichment) {
    return chunks.map((chunk) => ({
      ...chunk,
      summary: "",
      keywords: [],
      hypotheticalQuestions: [],
    }));
  }

  const enrichedChunks: EnrichedChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map((chunk) => enrichChunkWithRetry(chunk, filename))
    );

    for (let j = 0; j < batch.length; j++) {
      enrichedChunks.push({
        ...batch[j],
        ...batchResults[j],
      });
    }

    // Delay between batches (skip after the last batch)
    if (i + batchSize < chunks.length) {
      logger.info(
        `Enriched ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks, waiting ${batchDelayMs}ms...`,
        "enrichment"
      );
      await delay(batchDelayMs);
    }
  }

  logger.info(`Enrichment complete: ${enrichedChunks.length} chunks processed`, "enrichment");
  return enrichedChunks;
}
