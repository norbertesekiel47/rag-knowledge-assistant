import { createServiceClient } from "./server";
import type { EmbeddingProvider } from "../embeddings/config";
import { logger } from "@/lib/utils/logger";

export interface PgVectorChunkInput {
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  filename: string;
  fileType: string;
  embeddingProvider: EmbeddingProvider;
  embedding: number[];
  chunkType?: string;
  sectionTitle?: string;
  summary?: string;
  keywords?: string[];
  hypotheticalQuestions?: string[];
}

/**
 * Store document chunks with embeddings in the pgvector-backed document_embeddings table.
 * Maps the embedding to the correct vector column based on provider.
 */
export async function storePgVectorChunks(
  chunks: PgVectorChunkInput[]
): Promise<void> {
  if (chunks.length === 0) return;

  const supabase = createServiceClient();
  const provider = chunks[0].embeddingProvider;
  const embeddingColumn =
    provider === "voyage" ? "embedding_voyage" : "embedding_huggingface";

  const rows = chunks.map((chunk) => ({
    document_id: chunk.documentId,
    user_id: chunk.userId,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    filename: chunk.filename,
    file_type: chunk.fileType,
    embedding_provider: chunk.embeddingProvider,
    chunk_type: chunk.chunkType || "paragraph",
    section_title: chunk.sectionTitle || "",
    summary: chunk.summary || "",
    keywords: chunk.keywords || [],
    hypothetical_questions: chunk.hypotheticalQuestions || [],
    [embeddingColumn]: JSON.stringify(chunk.embedding),
  }));

  // Batch insert in groups of 50 to avoid payload limits
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("document_embeddings").insert(batch);

    if (error) {
      throw new Error(
        `pgvector insert failed (batch ${Math.floor(i / batchSize) + 1}): ${error.message}`
      );
    }
  }

  logger.info(
    `pgvector: stored ${chunks.length} chunks in document_embeddings (${provider})`,
    "pgvector"
  );
}

/**
 * Delete all pgvector chunks for a specific user.
 */
export async function deletePgVectorChunksByUser(
  userId: string
): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("document_embeddings")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new Error(`pgvector user delete failed: ${error.message}`);
  }

  const deletedCount = data?.length || 0;
  logger.info(`pgvector: deleted ${deletedCount} chunks for user ${userId}`, "pgvector");
  return deletedCount;
}

/**
 * Delete all pgvector chunks for a specific document.
 */
export async function deletePgVectorChunks(
  documentId: string
): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("document_embeddings")
    .delete()
    .eq("document_id", documentId)
    .select("id");

  if (error) {
    throw new Error(`pgvector delete failed: ${error.message}`);
  }

  const deletedCount = data?.length || 0;
  logger.info(
    `pgvector: deleted ${deletedCount} chunks for document ${documentId}`,
    "pgvector"
  );
  return deletedCount;
}
