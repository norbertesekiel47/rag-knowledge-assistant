import { getWeaviateClient } from "./client";
import { EmbeddingProvider, EMBEDDING_CONFIGS, getCollectionName } from "../embeddings/config";

export interface DocumentChunkProperties {
  content: string;
  documentId: string;
  userId: string;
  filename: string;
  fileType: string;
  chunkIndex: number;
}

/**
 * Initialize the Weaviate schema for a specific embedding provider
 */
export async function initializeWeaviateSchema(provider: EmbeddingProvider): Promise<void> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider);

  // Check if collection already exists
  const exists = await client.collections.exists(collectionName);

  if (exists) {
    console.log(`Collection '${collectionName}' already exists`);
    return;
  }

  // Create the collection
  await client.collections.create({
    name: collectionName,
    properties: [
      {
        name: "content",
        dataType: "text" as const,
        description: "The text content of the chunk",
      },
      {
        name: "documentId",
        dataType: "text" as const,
        description: "Reference to the source document",
        indexFilterable: true,
        indexSearchable: false,
      },
      {
        name: "userId",
        dataType: "text" as const,
        description: "Owner of the document",
        indexFilterable: true,
        indexSearchable: false,
      },
      {
        name: "filename",
        dataType: "text" as const,
        description: "Original filename",
      },
      {
        name: "fileType",
        dataType: "text" as const,
        description: "File type (pdf, md, txt)",
        indexFilterable: true,
        indexSearchable: false,
      },
      {
        name: "chunkIndex",
        dataType: "int" as const,
        description: "Index of chunk within document",
      },
    ],
    vectorizers: [],
  });

  console.log(`Collection '${collectionName}' created successfully`);
}

/**
 * Initialize schemas for all embedding providers
 */
export async function initializeAllSchemas(): Promise<void> {
  for (const provider of Object.keys(EMBEDDING_CONFIGS) as EmbeddingProvider[]) {
    await initializeWeaviateSchema(provider);
  }
}

export { getCollectionName };
