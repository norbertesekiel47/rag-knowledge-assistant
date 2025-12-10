import { createServiceClient } from "@/lib/supabase/server";
import { parseDocument } from "./parsers";
import { chunkDocument, DocumentChunk } from "./chunker";
import { storeChunks, deleteDocumentChunks } from "@/lib/weaviate/vectors";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings";

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunks: DocumentChunk[];
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
      console.log("No existing chunks to delete (collection may not exist yet)");
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

    console.log(
      `Document ${documentId} processed: ${chunks.length} chunks embedded and stored (${embeddingProvider})`
    );

    return {
      success: true,
      documentId,
      chunks,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`Error processing document ${documentId}:`, errorMessage);

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
    console.error("Error fetching pending documents:", error);
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