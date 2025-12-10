import { VoyageAIClient } from "voyageai";

let voyageClient: VoyageAIClient | null = null;

function getVoyageClient(): VoyageAIClient {
  if (voyageClient) {
    return voyageClient;
  }

  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable");
  }

  voyageClient = new VoyageAIClient({ apiKey });
  return voyageClient;
}

export const EMBEDDING_MODEL = "voyage-3-lite";
export const EMBEDDING_DIMENSIONS = 512;

/**
 * Generate embeddings for an array of texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getVoyageClient();

  try {
    const response = await client.embed({
      input: texts,
      model: EMBEDDING_MODEL,
      inputType: "document", // Use "document" for content, "query" for search queries
    });

    // Extract the embedding vectors
    const embeddings = response.data?.map((item) => item.embedding) ?? [];

    if (embeddings.length !== texts.length) {
      throw new Error(
        `Expected ${texts.length} embeddings, got ${embeddings.length}`
      );
    }

    // Filter out any undefined embeddings
    return embeddings.filter((e): e is number[] => e !== undefined);
  } catch (error) {
    console.error("Voyage AI embedding error:", error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate embedding for a single query (uses "query" input type for better retrieval)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const client = getVoyageClient();

  try {
    const response = await client.embed({
      input: [query],
      model: EMBEDDING_MODEL,
      inputType: "query", // Optimized for search queries
    });

    const embedding = response.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error("No embedding returned for query");
    }

    return embedding;
  } catch (error) {
    console.error("Voyage AI query embedding error:", error);
    throw new Error(
      `Failed to generate query embedding: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}