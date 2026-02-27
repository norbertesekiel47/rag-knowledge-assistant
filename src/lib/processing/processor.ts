import { createServiceClient } from "@/lib/supabase/server";
import { parseDocument } from "./parsers";
import { chunkDocument, DocumentChunk } from "./chunker";
import { storeChunks, deleteDocumentChunks } from "@/lib/weaviate/vectors";
import { storeEnrichedChunks, deleteDocumentChunksV2 } from "@/lib/weaviate/vectors";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings";
import { parseDocumentStructured } from "./structuredParsers";
import { chunkStructuredDocument } from "./smartChunker";
import { enrichChunks } from "./enrichment";
import type { EnrichedChunkForStorage, EnrichmentOptions } from "./types";
import { logger } from "@/lib/utils/logger";

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunks: DocumentChunk[];
  error?: string;
}

export interface ProcessingResultV2 {
  success: boolean;
  documentId: string;
  chunkCount: number;
  error?: string;
}

/**
 * Process a single document: download, parse, chunk, embed, and store
 */
export async function processDocument(
  documentId: string,
  embeddingProvider: EmbeddingProvider = DEFAULT_EMBEDDING_PROVIDER
): Promise<ProcessingResult> {
  const supabase = createServiceClient();

  try {
    // 1. Fetch document record
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // 2. Update status to processing
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // 3. Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 4. Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Parse document based on type
    const parsed = await parseDocument(buffer, document.file_type);

    if (!parsed.content || parsed.content.length === 0) {
      throw new Error("Document appears to be empty or could not be parsed");
    }

    // 6. Chunk the content
    const chunks = await chunkDocument(parsed.content, {
      documentId: document.id,
      filename: document.filename,
      fileType: document.file_type,
      ...parsed.metadata,
    });

    if (chunks.length === 0) {
      throw new Error("No chunks created from document");
    }

    // 7. Delete any existing chunks for this document (in case of reprocessing)
    try {
      await deleteDocumentChunks(documentId, embeddingProvider);
    } catch {
      // Collection might not exist yet, that's OK
      logger.info("No existing chunks to delete (collection may not exist yet)", "processing");
    }

    // 8. Store chunks with embeddings in Weaviate
    const chunksToStore = chunks.map((chunk) => ({
      content: chunk.content,
      documentId: document.id,
      userId: document.user_id,
      filename: document.filename,
      fileType: document.file_type,
      chunkIndex: chunk.chunkIndex,
    }));

    await storeChunks(chunksToStore, embeddingProvider);

    // 9. Update document status to processed
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "processed",
        chunk_count: chunks.length,
      })
      .eq("id", documentId);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    logger.info(
      `Document ${documentId} processed: ${chunks.length} chunks embedded and stored (${embeddingProvider})`,
      "processing"
    );

    return {
      success: true,
      documentId,
      chunks,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error(`Error processing document ${documentId}`, "processing", {
      error: { message: errorMessage },
    });

    // Update document status to failed
    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", documentId);

    return {
      success: false,
      documentId,
      chunks: [],
      error: errorMessage,
    };
  }
}

/**
 * Process all pending documents for a user
 */
export async function processPendingDocuments(
  userId: string,
  embeddingProvider: EmbeddingProvider = DEFAULT_EMBEDDING_PROVIDER
): Promise<ProcessingResult[]> {
  const supabase = createServiceClient();

  const { data: pendingDocs, error } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    logger.error("Error fetching pending documents", "processing", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return [];
  }

  if (!pendingDocs || pendingDocs.length === 0) {
    return [];
  }

  const results = await Promise.all(
    pendingDocs.map((doc) => processDocument(doc.id, embeddingProvider))
  );

  return results;
}

// ============================================================================
// V2 Processing Pipeline — Structure-aware parsing, smart chunking, enrichment
// ============================================================================

/**
 * Process a document using the V2 pipeline:
 * 1. Download from Supabase
 * 2. Structure-aware parsing (detects headings, tables, code, lists)
 * 3. Smart chunking (respects document boundaries)
 * 4. LLM enrichment (summary, keywords, hypothetical questions)
 * 5. Embed and store in V2 Weaviate collections
 */
export async function processDocumentV2(
  documentId: string,
  embeddingProvider: EmbeddingProvider = DEFAULT_EMBEDDING_PROVIDER,
  enrichmentOptions?: EnrichmentOptions
): Promise<ProcessingResultV2> {
  const supabase = createServiceClient();

  try {
    // 1. Fetch document record
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // 2. Update status to processing
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // 3. Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 4. Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Structure-aware parsing
    const structured = await parseDocumentStructured(buffer, document.file_type);

    if (structured.sections.length === 0) {
      throw new Error("Document appears to be empty or could not be parsed");
    }

    logger.info(
      `V2 Parsed ${document.filename}: ${structured.sections.length} sections detected`,
      "processing"
    );

    // 6. Smart chunking
    const preEnrichmentChunks = await chunkStructuredDocument(structured);

    if (preEnrichmentChunks.length === 0) {
      throw new Error("No chunks created from document");
    }

    logger.info(
      `V2 Chunked ${document.filename}: ${preEnrichmentChunks.length} smart chunks created`,
      "processing"
    );

    // 7. LLM enrichment (summaries, keywords, hypothetical questions)
    const enrichedChunks = await enrichChunks(
      preEnrichmentChunks,
      document.filename,
      enrichmentOptions
    );

    // 8. Delete any existing V2 chunks for this document (reprocessing safety)
    try {
      await deleteDocumentChunksV2(documentId, embeddingProvider);
    } catch {
      logger.info("No existing V2 chunks to delete (collection may not exist yet)", "processing");
    }

    // 9. Prepare chunks for storage
    const chunksForStorage: EnrichedChunkForStorage[] = enrichedChunks.map((chunk) => ({
      content: chunk.content,
      documentId: document.id,
      userId: document.user_id,
      filename: document.filename,
      fileType: document.file_type,
      chunkIndex: chunk.chunkIndex,
      chunkType: chunk.chunkType,
      sectionTitle: chunk.sectionTitle,
      summary: chunk.summary,
      keywords: chunk.keywords,
      hypotheticalQuestions: chunk.hypotheticalQuestions,
    }));

    // 10. Store enriched chunks with embeddings in V2 Weaviate collection
    await storeEnrichedChunks(chunksForStorage, embeddingProvider);

    // 11. Update document status
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "processed",
        chunk_count: enrichedChunks.length,
      })
      .eq("id", documentId);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    logger.info(
      `V2 Document ${documentId} processed: ${enrichedChunks.length} enriched chunks stored (${embeddingProvider})`,
      "processing"
    );

    return {
      success: true,
      documentId,
      chunkCount: enrichedChunks.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error(`V2 Error processing document ${documentId}`, "processing", {
      error: { message: errorMessage },
    });

    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", documentId);

    return {
      success: false,
      documentId,
      chunkCount: 0,
      error: errorMessage,
    };
  }
}