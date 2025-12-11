export const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

const HF_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;

/**
 * Generate embeddings for an array of texts using Hugging Face Inference API
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable");
  }

  try {
    // Process in batches to avoid rate limits
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
          options: {
            wait_for_model: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
      }

      const embeddings = await response.json();

      // Handle the response format
      if (Array.isArray(embeddings)) {
        for (const embedding of embeddings) {
          // The API returns nested arrays for sentence-transformers
          if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
            // Mean pooling for token embeddings
            const pooled = meanPool(embedding);
            allEmbeddings.push(pooled);
          } else if (Array.isArray(embedding)) {
            allEmbeddings.push(embedding);
          }
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return allEmbeddings;
  } catch (error) {
    console.error("Hugging Face embedding error:", error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate embedding for a single query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query]);

  if (embeddings.length === 0) {
    throw new Error("No embedding returned for query");
  }

  return embeddings[0];
}

/**
 * Mean pooling for token-level embeddings
 */
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