import { EmbeddingProvider } from "./config";
import { InferenceClient } from "@huggingface/inference";

export * from "./config";

// Voyage AI implementation
async function generateVoyageEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable");
  }

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
}

async function generateVoyageQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable");
  }

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
    const response = await client.featureExtraction({
      model: HF_MODEL_ID,
      inputs: text,
    });

    // Response is number[] for single input
    if (Array.isArray(response)) {
      allEmbeddings.push(response as number[]);
    }
  }

  return allEmbeddings;
}

async function generateHuggingFaceQueryEmbedding(query: string): Promise<number[]> {
  const client = getHfClient();

  const response = await client.featureExtraction({
    model: HF_MODEL_ID,
    inputs: query,
  });

  if (Array.isArray(response)) {
    return response as number[];
  }

  throw new Error("Unexpected embedding format from Hugging Face API");
}

function meanPool(tokenEmbeddings: number[][]): number[] {
  if (tokenEmbeddings.length === 0) return [];

  const dimensions = tokenEmbeddings[0].length;
  const pooled = new Array(dimensions).fill(0);

  for (const embedding of tokenEmbeddings) {
    for (let i = 0; i < dimensions; i++) {
      pooled[i] += embedding[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    pooled[i] /= tokenEmbeddings.length;
  }

  return pooled;
}

// Unified interface
export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider
): Promise<number[][]> {
  switch (provider) {
    case "voyage":
      return generateVoyageEmbeddings(texts);
    case "huggingface":
      return generateHuggingFaceEmbeddings(texts);
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }
}

export async function generateQueryEmbedding(
  query: string,
  provider: EmbeddingProvider
): Promise<number[]> {
  switch (provider) {
    case "voyage":
      return generateVoyageQueryEmbedding(query);
    case "huggingface":
      return generateHuggingFaceQueryEmbedding(query);
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }
}