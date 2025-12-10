import { getWeaviateClient } from "./client";

export const COLLECTION_NAME = "DocumentChunk";

export interface DocumentChunkProperties {
  content: string;
  documentId: string;
  userId: string;
  filename: string;
  fileType: string;
  chunkIndex: number;
}

/**
 * Initialize the Weaviate schema (create collection if it doesn't exist)
 */
export async function initializeWeaviateSchema(): Promise<void> {
  const client = await getWeaviateClient();

  // Check if collection already exists
  const exists = await client.collections.exists(COLLECTION_NAME);

  if (exists) {
    console.log(`Collection '${COLLECTION_NAME}' already exists`);
    return;
  }

  // Create the collection
  await client.collections.create({
    name: COLLECTION_NAME,
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
    // We'll provide our own vectors from Voyage AI
    vectorizers: [],
  });

  console.log(`Collection '${COLLECTION_NAME}' created successfully`);
}