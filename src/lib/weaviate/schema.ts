import { getWeaviateClient } from "./client";
import { EmbeddingProvider, EMBEDDING_CONFIGS, getCollectionName } from "../embeddings/config";
import type { ChunkType } from "../processing/types";
import { logger } from "@/lib/utils/logger";

export interface DocumentChunkProperties {
  content: string;
  documentId: string;
  userId: string;
  filename: string;
  fileType: string;
  chunkIndex: number;
}

export interface DocumentChunkPropertiesV2 extends DocumentChunkProperties {
  chunkType: ChunkType;
  sectionTitle: string;
  summary: string;
  keywords: string[];
  hypotheticalQuestions: string[];
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
    logger.info(`Collection '${collectionName}' already exists`, "weaviate");
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

  logger.info(`Collection '${collectionName}' created successfully`, "weaviate");
}

/**
 * Initialize the V2 Weaviate schema with enriched metadata properties
 */
export async function initializeWeaviateSchemaV2(provider: EmbeddingProvider): Promise<void> {
  const client = await getWeaviateClient();
  const collectionName = getCollectionName(provider, 2);

  const exists = await client.collections.exists(collectionName);

  if (exists) {
    logger.info(`Collection '${collectionName}' already exists`, "weaviate");
    return;
  }

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
      {
        name: "chunkType",
        dataType: "text" as const,
        description: "Type of chunk (paragraph, heading, code, table, list)",
        indexFilterable: true,
        indexSearchable: false,
      },
      {
        name: "sectionTitle",
        dataType: "text" as const,
        description: "The heading this chunk belongs to",
        indexFilterable: true,
        indexSearchable: true,
      },
      {
        name: "summary",
        dataType: "text" as const,
        description: "LLM-generated summary of the chunk",
        indexSearchable: true,
      },
      {
        name: "keywords",
        dataType: "text[]" as const,
        description: "Extracted keywords from the chunk",
        indexFilterable: true,
      },
      {
        name: "hypotheticalQuestions",
        dataType: "text[]" as const,
        description: "Questions this chunk could answer (HyDE)",
        indexSearchable: true,
      },
    ],
    vectorizers: [],
  });

  logger.info(`V2 Collection '${collectionName}' created successfully`, "weaviate");
}

/**
 * Initialize schemas for all embedding providers
 */
export async function initializeAllSchemas(): Promise<void> {
  for (const provider of Object.keys(EMBEDDING_CONFIGS) as EmbeddingProvider[]) {
    await initializeWeaviateSchema(provider);
  }
}

/**
 * Initialize V2 schemas for all embedding providers
 */
export async function initializeAllSchemasV2(): Promise<void> {
  for (const provider of Object.keys(EMBEDDING_CONFIGS) as EmbeddingProvider[]) {
    await initializeWeaviateSchemaV2(provider);
  }
}

/**
 * Check if a collection exists in Weaviate
 */
export async function checkCollectionExists(collectionName: string): Promise<boolean> {
  try {
    const client = await getWeaviateClient();
    const exists = await client.collections.exists(collectionName);
    return exists;
  } catch (error) {
    logger.error(`Error checking collection ${collectionName}`, "weaviate", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return false;
  }
}

export { getCollectionName };
