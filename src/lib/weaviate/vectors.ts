import { getWeaviateClient } from "./client";
import { COLLECTION_NAME } from "./schema";
import { generateEmbeddings, generateQueryEmbedding } from "../embeddings/voyage";

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
export async function storeChunks(chunks: ChunkWithEmbedding[]): Promise<void> {
  if (chunks.length === 0) {
    return;
  }

  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);

  // Generate embeddings for all chunks
  const texts = chunks.map((chunk) => chunk.content);
  const embeddings = await generateEmbeddings(texts);

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

  console.log(`Successfully stored ${chunks.length} chunks in Weaviate`);
}

/**
 * Search for similar chunks using semantic search
 */
export async function searchChunks(
  query: string,
  userId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);

  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);

  // Search with user filter using byProperty syntax
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
    // Convert distance to similarity score (0-1, higher is better)
    score: 1 - (obj.metadata?.distance ?? 0),
  }));
}

/**
 * Delete all chunks for a specific document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);

  await collection.data.deleteMany(
    collection.filter.byProperty("documentId").equal(documentId)
  );

  console.log(`Deleted chunks for document ${documentId}`);
}

/**
 * Delete all chunks for a specific user
 */
export async function deleteUserChunks(userId: string): Promise<void> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);

  await collection.data.deleteMany(
    collection.filter.byProperty("userId").equal(userId)
  );

  console.log(`Deleted all chunks for user ${userId}`);
}