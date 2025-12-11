import { getWeaviateClient } from "./client";
import { getCollectionName } from "./schema";
import {
  generateEmbeddings,
  generateQueryEmbedding,
  EmbeddingProvider,
} from "../embeddings";

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
 * Store document chunks with their embeddings in Weaviate
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

  // Insert objects one by one with vectors
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    await collection.data.insert({
      properties: {
        content: chunk.content,
        documentId: chunk.documentId,
        userId: chunk.userId,
        filename: chunk.filename,
        fileType: chunk.fileType,
        chunkIndex: chunk.chunkIndex,
      },
      vectors: embedding,
    });
  }

  console.log(`Successfully stored ${chunks.length} chunks in Weaviate (${collectionName})`);
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

  // Search with user filter
  const response = await collection.query.nearVector(queryEmbedding, {
    limit,
    returnMetadata: ["distance"],
    filters: collection.filter.byProperty("userId").equal(userId),
  });

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

  // Use the correct filter syntax for Weaviate v3
  const result = await collection.data.deleteMany(
    collection.filter.byProperty("documentId").equal(documentId)
  );

  const deletedCount = result.successful || 0;
  console.log(`Deleted ${deletedCount} chunks for document ${documentId} from ${collectionName}`);
  
  return deletedCount;
}

/**
 * Delete all chunks for a specific user
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

  console.log(`Deleted all chunks for user ${userId} from ${collectionName}`);
}