import { EmbeddingProvider, EMBEDDING_CONFIGS, getCollectionName } from "./config";

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

// Hugging Face implementation
const HF_API_URL =
  "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";

async function generateHuggingFaceEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable");
  }

  const batchSize = 10;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: batch,
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const embeddings = await response.json();

    if (Array.isArray(embeddings)) {
      for (const embedding of embeddings) {
        if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
          const pooled = meanPool(embedding);
          allEmbeddings.push(pooled);
        } else if (Array.isArray(embedding)) {
          allEmbeddings.push(embedding);
        }
      }
    }

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return allEmbeddings;
}

async function generateHuggingFaceQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateHuggingFaceEmbeddings([query]);

  if (embeddings.length === 0) {
    throw new Error("No embedding returned for query");
  }

  return embeddings[0];
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