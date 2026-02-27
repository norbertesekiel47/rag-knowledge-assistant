/**
 * Types for the V2 structured processing pipeline.
 * Structure-aware parsing, smart chunking, and metadata enrichment.
 */

export type ChunkType = "paragraph" | "heading" | "code" | "table" | "list" | "frontmatter";

/**
 * A single structural section extracted from a parsed document.
 * Preserves the semantic meaning and type of each document element.
 */
export interface StructuredSection {
  type: ChunkType;
  content: string;
  /** Heading level (1-6) when type is "heading" */
  level?: number;
  /** Code language when type is "code" */
  language?: string;
  /** The nearest heading above this section */
  parentHeading?: string;
  /** Order within the document */
  position: number;
}

/**
 * The result of structure-aware document parsing.
 * Contains typed sections instead of a flat string.
 */
export interface StructuredDocument {
  sections: StructuredSection[];
  metadata: Record<string, unknown>;
  /** Original full text for fallback/validation */
  rawContent: string;
}

/**
 * A chunk produced by the smart chunker, before LLM enrichment.
 */
export interface PreEnrichmentChunk {
  content: string;
  chunkIndex: number;
  chunkType: ChunkType;
  sectionTitle: string;
  metadata: {
    startChar: number;
    endChar: number;
    [key: string]: unknown;
  };
}

/**
 * A fully enriched chunk with LLM-generated metadata.
 * This is the final form before embedding and storage.
 */
export interface EnrichedChunk extends PreEnrichmentChunk {
  summary: string;
  keywords: string[];
  hypotheticalQuestions: string[];
}

/**
 * Enriched chunk with embedding vector, ready for Weaviate storage.
 */
export interface EnrichedChunkForStorage {
  content: string;
  documentId: string;
  userId: string;
  filename: string;
  fileType: string;
  chunkIndex: number;
  chunkType: ChunkType;
  sectionTitle: string;
  summary: string;
  keywords: string[];
  hypotheticalQuestions: string[];
}

/**
 * V2 search result including enriched metadata.
 */
export interface SearchResultV2 {
  content: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  chunkType: ChunkType;
  sectionTitle: string;
  summary: string;
  keywords: string[];
  hypotheticalQuestions: string[];
}

/**
 * Options for the smart chunker.
 */
export interface SmartChunkOptions {
  /** Target chunk size in tokens (default: 400) */
  targetTokens?: number;
  /** Maximum chunk size in tokens before fallback splitting (default: 1024) */
  maxTokens?: number;
  /** Overlap in tokens for fallback splitting (default: 50) */
  overlapTokens?: number;
}

/**
 * Filters for hybrid search (pgvector + relational filtering).
 */
export interface SearchFilters {
  /** Scope search to specific document IDs */
  documentIds?: string[];
  /** Filter by file type: "pdf", "md", "txt" */
  fileType?: string;
  /** Only include chunks from documents created after this date (ISO string) */
  createdAfter?: string;
  /** Only include chunks from documents created before this date (ISO string) */
  createdBefore?: string;
  /** Full-text keyword search (additive to semantic search) */
  keyword?: string;
}

/**
 * Options for the enrichment pipeline.
 */
export interface EnrichmentOptions {
  /** Number of chunks to process per batch (default: 5) */
  batchSize?: number;
  /** Delay in ms between batches (default: 2000) */
  batchDelayMs?: number;
  /** Skip enrichment entirely (for testing) */
  skipEnrichment?: boolean;
}
