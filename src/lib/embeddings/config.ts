export type EmbeddingProvider = "voyage" | "huggingface";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  description: string;
  limitations: string[];
  collectionSuffix: string;
}

export const EMBEDDING_CONFIGS: Record<EmbeddingProvider, EmbeddingConfig> = {
  voyage: {
    provider: "voyage",
    model: "voyage-3-lite",
    dimensions: 512,
    description: "Voyage AI's embedding model optimized for RAG applications. Higher quality retrieval.",
    limitations: [
      "Free tier: 3 requests per minute (RPM)",
      "Free tier: 10,000 tokens per minute (TPM)",
      "Add payment method at dashboard.voyageai.com for higher limits",
      "200M free tokens even with payment method added",
    ],
    collectionSuffix: "Voyage",
  },
  huggingface: {
    provider: "huggingface",
    model: "sentence-transformers/all-MiniLM-L6-v2",
    dimensions: 384,
    description: "Open-source model from Hugging Face. Completely free with generous rate limits.",
    limitations: [
      "Slightly lower retrieval quality than Voyage",
      "May have occasional cold starts (model loading)",
      "Best for development and testing",
    ],
    collectionSuffix: "HuggingFace",
  },
};

export const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProvider = "huggingface";

// Get collection name based on provider
export function getCollectionName(provider: EmbeddingProvider): string {
  return `DocumentChunk${EMBEDDING_CONFIGS[provider].collectionSuffix}`;
}