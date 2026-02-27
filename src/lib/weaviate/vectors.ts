import { getWeaviateClient } from "./client";
import { getCollectionName } from "./schema";
import {
  generateEmbeddings,
  generateQueryEmbedding,
  EmbeddingProvider,
} from "../embeddings";
import type { EnrichedChunkForStorage, SearchResultV2 } from "../processing/types";
import { storePgVectorChunks, deletePgVectorChunks, deletePgVectorChunksByUser } from "../supabase/pgvector";
import { withRetry, isTransientError } from "@/lib/utils/retry";
import { logger } from "@/lib/utils/logger";

export interface ChunkWithEmbedding {
  content: string;
  documentId: string;
  userId: string;
  filename: string;
  fileType: string;
  chunkIndex: number;
}

export interface SearchResult {
  content: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

/**
 * Store document chunks with their embeddings in Weaviate (batch insert)
 */
export async function storeChunks(
  chunks: ChunkWithEmbedding[],
  provider: EmbeddingProvider
): Promise<void> {
  if (chunks.length === 0) {
    return;
  }

  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider);
  const collection = client.collections.get(collectionName);

  // Generate embeddings for all chunks
  const texts = chunks.map((chunk) => chunk.content);
  const embeddings = await generateEmbeddings(texts, provider);

  // Dual-write to pgvector (non-blocking)
  storePgVectorChunks(
    chunks.map((chunk, i) => ({
      documentId: chunk.documentId,
      userId: chunk.userId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      filename: chunk.filename,
      fileType: chunk.fileType,
      embeddingProvider: provider,
      embedding: embeddings[i],
    }))
  ).catch((err) => {
    logger.warn("pgvector dual-write failed (non-fatal)", "vectors", {
      error: err instanceof Error ? { message: err.message } : { error: String(err) },
    });
  });

  // Batch insert using insertMany (same pattern as storeEnrichedChunks)
  const objects = chunks.map((chunk, i) => ({
    properties: {
      content: chunk.content,
      documentId: chunk.documentId,
      userId: chunk.userId,
      filename: chunk.filename,
      fileType: chunk.fileType,
      chunkIndex: chunk.chunkIndex,
    },
    vectors: embeddings[i],
  }));

  const result = await withRetry(
    () => collection.data.insertMany(objects),
    { maxRetries: 2, initialDelayMs: 1000, isRetryable: isTransientError },
    "weaviate-batch-insert"
  );

  if (result.hasErrors) {
    const errors = Object.values(result.errors || {});
    logger.error(`Batch insert had ${errors.length} errors`, "vectors", {
      errors: errors.slice(0, 3),
    });
    throw new Error(`Failed to insert ${errors.length} of ${chunks.length} chunks`);
  }

  logger.info(`Stored ${chunks.length} chunks in ${collectionName}`, "vectors");
}

/**
 * Search for similar chunks using semantic search
 */
export async function searchChunks(
  query: string,
  userId: string,
  provider: EmbeddingProvider,
  limit: number = 5
): Promise<SearchResult[]> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider);
  const collection = client.collections.get(collectionName);

  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query, provider);

  // Search with user filter (retry on transient failures)
  const response = await withRetry(
    () =>
      collection.query.nearVector(queryEmbedding, {
        limit,
        returnMetadata: ["distance"],
        filters: collection.filter.byProperty("userId").equal(userId),
      }),
    { maxRetries: 2, initialDelayMs: 1000, isRetryable: isTransientError },
    "weaviate-search"
  );

  // Transform results
  return response.objects.map((obj) => ({
    content: obj.properties.content as string,
    documentId: obj.properties.documentId as string,
    filename: obj.properties.filename as string,
    chunkIndex: obj.properties.chunkIndex as number,
    score: 1 - (obj.metadata?.distance ?? 0),
  }));
}

/**
 * Delete all chunks for a specific document
 */
export async function deleteDocumentChunks(
  documentId: string,
  provider: EmbeddingProvider
): Promise<number> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider);
  const collection = client.collections.get(collectionName);

  // Dual-delete from pgvector (non-blocking)
  deletePgVectorChunks(documentId).catch((err) => {
    logger.warn("pgvector dual-delete failed (non-fatal)", "vectors", {
      error: err instanceof Error ? { message: err.message } : { error: String(err) },
    });
  });

  // Use the correct filter syntax for Weaviate v3
  const result = await collection.data.deleteMany(
    collection.filter.byProperty("documentId").equal(documentId)
  );

  const deletedCount = result.successful || 0;
  logger.info(`Deleted ${deletedCount} chunks for document ${documentId} from ${collectionName}`, "vectors");

  return deletedCount;
}

/**
 * Delete all chunks for a specific user from a single collection
 */
export async function deleteUserChunks(
  userId: string,
  provider: EmbeddingProvider
): Promise<void> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider);
  const collection = client.collections.get(collectionName);

  await collection.data.deleteMany(
    collection.filter.byProperty("userId").equal(userId)
  );

  logger.info(`Deleted all chunks for user ${userId} from ${collectionName}`, "vectors");
}

/**
 * Delete ALL user data from Weaviate (both providers, V1 + V2) and pgvector.
 * Used during account deletion to ensure complete cleanup.
 */
export async function deleteAllUserChunks(userId: string): Promise<void> {
  const client = await getWeaviateClient();
  const providers: EmbeddingProvider[] = ["voyage", "huggingface"];

  for (const provider of providers) {
    for (const version of [1, 2] as const) {
      try {
        const collectionName = getCollectionName(provider, version);
        const collection = client.collections.get(collectionName);
        await collection.data.deleteMany(
          collection.filter.byProperty("userId").equal(userId)
        );
        logger.info(`Deleted user ${userId} chunks from ${collectionName}`, "vectors");
      } catch (err) {
        // Collection may not exist yet — safe to skip
        logger.warn(`Weaviate cleanup skipped for ${provider} v${version}`, "vectors", {
          error: err instanceof Error ? { message: err.message } : { error: String(err) },
        });
      }
    }
  }

  // Also clean up pgvector
  try {
    await deletePgVectorChunksByUser(userId);
  } catch (err) {
    logger.warn("pgvector user cleanup failed (non-fatal)", "vectors", {
      error: err instanceof Error ? { message: err.message } : { error: String(err) },
    });
  }
}

// ============================================================================
// V2 Functions — Enriched chunks with batch insertion
// ============================================================================

/**
 * Store enriched document chunks in V2 Weaviate collections using batch insertion.
 * Embeds the chunk content (not the metadata) for vector search.
 */
export async function storeEnrichedChunks(
  chunks: EnrichedChunkForStorage[],
  provider: EmbeddingProvider
): Promise<void> {
  if (chunks.length === 0) return;

  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider, 2);
  const collection = client.collections.get(collectionName);

  // Generate embeddings for all chunk contents
  const texts = chunks.map((chunk) => chunk.content);
  const embeddings = await generateEmbeddings(texts, provider);

  // Dual-write to pgvector (non-blocking)
  storePgVectorChunks(
    chunks.map((chunk, i) => ({
      documentId: chunk.documentId,
      userId: chunk.userId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      filename: chunk.filename,
      fileType: chunk.fileType,
      embeddingProvider: provider,
      embedding: embeddings[i],
      chunkType: chunk.chunkType,
      sectionTitle: chunk.sectionTitle,
      summary: chunk.summary,
      keywords: chunk.keywords,
      hypotheticalQuestions: chunk.hypotheticalQuestions,
    }))
  ).catch((err) => {
    logger.warn("pgvector dual-write failed (non-fatal)", "vectors", {
      error: err instanceof Error ? { message: err.message } : { error: String(err) },
    });
  });

  // Batch insert using insertMany
  const objects = chunks.map((chunk, i) => ({
    properties: {
      content: chunk.content,
      documentId: chunk.documentId,
      userId: chunk.userId,
      filename: chunk.filename,
      fileType: chunk.fileType,
      chunkIndex: chunk.chunkIndex,
      chunkType: chunk.chunkType,
      sectionTitle: chunk.sectionTitle,
      summary: chunk.summary,
      keywords: chunk.keywords,
      hypotheticalQuestions: chunk.hypotheticalQuestions,
    },
    vectors: embeddings[i],
  }));

  const result = await withRetry(
    () => collection.data.insertMany(objects),
    { maxRetries: 2, initialDelayMs: 1000, isRetryable: isTransientError },
    "weaviate-v2-batch-insert"
  );

  if (result.hasErrors) {
    const errors = Object.values(result.errors || {});
    logger.error(`Batch insert had ${errors.length} errors`, "vectors", {
      errors: errors.slice(0, 3),
    });
    throw new Error(`Failed to insert ${errors.length} of ${chunks.length} chunks`);
  }

  logger.info(`Stored ${chunks.length} enriched chunks in ${collectionName}`, "vectors");
}

/**
 * Search V2 collections and return enriched results including metadata.
 */
export async function searchChunksV2(
  query: string,
  userId: string,
  provider: EmbeddingProvider,
  limit: number = 5
): Promise<SearchResultV2[]> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider, 2);
  const collection = client.collections.get(collectionName);

  const queryEmbedding = await generateQueryEmbedding(query, provider);

  const response = await withRetry(
    () =>
      collection.query.nearVector(queryEmbedding, {
        limit,
        returnMetadata: ["distance"],
        filters: collection.filter.byProperty("userId").equal(userId),
      }),
    { maxRetries: 2, initialDelayMs: 1000, isRetryable: isTransientError },
    "weaviate-v2-search"
  );

  return response.objects.map((obj) => ({
    content: obj.properties.content as string,
    documentId: obj.properties.documentId as string,
    filename: obj.properties.filename as string,
    chunkIndex: obj.properties.chunkIndex as number,
    score: 1 - (obj.metadata?.distance ?? 0),
    chunkType: (obj.properties.chunkType as string || "paragraph") as SearchResultV2["chunkType"],
    sectionTitle: (obj.properties.sectionTitle as string) || "",
    summary: (obj.properties.summary as string) || "",
    keywords: (obj.properties.keywords as string[]) || [],
    hypotheticalQuestions: (obj.properties.hypotheticalQuestions as string[]) || [],
  }));
}

/**
 * Delete all V2 chunks for a specific document.
 */
export async function deleteDocumentChunksV2(
  documentId: string,
  provider: EmbeddingProvider
): Promise<number> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider, 2);
  const collection = client.collections.get(collectionName);

  // Dual-delete from pgvector (non-blocking, V1 delete already handles it but safe to call again)
  deletePgVectorChunks(documentId).catch((err) => {
    logger.warn("pgvector dual-delete failed (non-fatal)", "vectors", {
      error: err instanceof Error ? { message: err.message } : { error: String(err) },
    });
  });

  const result = await collection.data.deleteMany(
    collection.filter.byProperty("documentId").equal(documentId)
  );

  const deletedCount = result.successful || 0;
  logger.info(`Deleted ${deletedCount} V2 chunks for document ${documentId} from ${collectionName}`, "vectors");

  return deletedCount;
}
