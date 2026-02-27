import { EmbeddingProvider } from "./config";
import { InferenceClient } from "@huggingface/inference";
import { cacheGet, cacheSet, embeddingCacheKey } from "@/lib/redis/cache";
import { withRetryAndTimeout, isTransientError } from "@/lib/utils/retry";
import { logger } from "@/lib/utils/logger";

export * from "./config";

// Voyage AI implementation
async function generateVoyageEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable");
  }

  return withRetryAndTimeout(
    async () => {
      // Dynamic import to avoid loading if not used
      const { VoyageAIClient } = await import("voyageai");
      const client = new VoyageAIClient({ apiKey });

      const response = await client.embed({
        input: texts,
        model: "voyage-3-lite",
        inputType: "document",
      });

      const embeddings = response.data?.map((item) => item.embedding) ?? [];

      if (embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, got ${embeddings.length}`);
      }

      return embeddings.filter((e): e is number[] => e !== undefined);
    },
    { maxRetries: 2, initialDelayMs: 2000, isRetryable: isTransientError },
    { timeoutMs: 20000 },
    "voyage-embed"
  );
}

async function generateVoyageQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable");
  }

  return withRetryAndTimeout(
    async () => {
      const { VoyageAIClient } = await import("voyageai");
      const client = new VoyageAIClient({ apiKey });

      const response = await client.embed({
        input: [query],
        model: "voyage-3-lite",
        inputType: "query",
      });

      const embedding = response.data?.[0]?.embedding;

      if (!embedding) {
        throw new Error("No embedding returned for query");
      }

      return embedding;
    },
    { maxRetries: 2, initialDelayMs: 2000, isRetryable: isTransientError },
    { timeoutMs: 20000 },
    "voyage-query-embed"
  );
}

// Hugging Face implementation - Using official SDK
const HF_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2";

let hfClient: InferenceClient | null = null;

function getHfClient(): InferenceClient {
  if (hfClient) return hfClient;

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable");
  }

  hfClient = new InferenceClient(apiKey);
  return hfClient;
}

async function generateHuggingFaceEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getHfClient();
  const allEmbeddings: number[][] = [];

  // Process one at a time to avoid issues
  for (const text of texts) {
    const embedding = await withRetryAndTimeout(
      async () => {
        const response = await client.featureExtraction({
          model: HF_MODEL_ID,
          inputs: text,
        });

        // Response is number[] for single input
        if (Array.isArray(response)) {
          return response as number[];
        }

        throw new Error("Unexpected embedding format from HuggingFace");
      },
      { maxRetries: 2, initialDelayMs: 2000, isRetryable: isTransientError },
      { timeoutMs: 20000 },
      "hf-embed"
    );

    allEmbeddings.push(embedding);
  }

  return allEmbeddings;
}

async function generateHuggingFaceQueryEmbedding(query: string): Promise<number[]> {
  const client = getHfClient();

  return withRetryAndTimeout(
    async () => {
      const response = await client.featureExtraction({
        model: HF_MODEL_ID,
        inputs: query,
      });

      if (Array.isArray(response)) {
        return response as number[];
      }

      throw new Error("Unexpected embedding format from Hugging Face API");
    },
    { maxRetries: 2, initialDelayMs: 2000, isRetryable: isTransientError },
    { timeoutMs: 20000 },
    "hf-query-embed"
  );
}

// Unified interface
export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider
): Promise<number[][]> {
  try {
    switch (provider) {
      case "voyage":
        return await generateVoyageEmbeddings(texts);
      case "huggingface":
        return await generateHuggingFaceEmbeddings(texts);
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  } catch (error) {
    logger.error(
      `Embedding generation failed (${provider}, ${texts.length} texts)`,
      "embeddings",
      { error: error instanceof Error ? { message: error.message } : { error: String(error) } }
    );
    throw error;
  }
}

export async function generateQueryEmbedding(
  query: string,
  provider: EmbeddingProvider
): Promise<number[]> {
  // Check cache first
  const key = embeddingCacheKey(provider, query);
  const cached = await cacheGet<number[]>(key);
  if (cached) return cached;

  let embedding: number[];
  switch (provider) {
    case "voyage":
      embedding = await generateVoyageQueryEmbedding(query);
      break;
    case "huggingface":
      embedding = await generateHuggingFaceQueryEmbedding(query);
      break;
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }

  // Cache for 24 hours
  await cacheSet(key, embedding, 86400);
  return embedding;
}
