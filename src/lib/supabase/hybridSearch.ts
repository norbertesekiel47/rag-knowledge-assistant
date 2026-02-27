import { createServiceClient } from "./server";
import { generateQueryEmbedding } from "../embeddings";
import type { EmbeddingProvider } from "../embeddings/config";
import type { SearchResultV2, SearchFilters } from "../processing/types";

export interface HybridSearchOptions {
  query: string;
  userId: string;
  provider: EmbeddingProvider;
  filters?: SearchFilters;
  limit?: number;
}

/**
 * Hybrid search combining pgvector similarity with relational SQL filters.
 * Uses the `hybrid_search` Supabase RPC function.
 */
export async function hybridSearch(
  options: HybridSearchOptions
): Promise<SearchResultV2[]> {
  const { query, userId, provider, filters = {}, limit = 10 } = options;

  const supabase = createServiceClient();
  const queryEmbedding = await generateQueryEmbedding(query, provider);

  const embeddingColumn =
    provider === "voyage" ? "embedding_voyage" : "embedding_huggingface";

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_embedding: JSON.stringify(queryEmbedding),
    embedding_col: embeddingColumn,
    match_user_id: userId,
    match_count: limit,
    filter_document_ids: filters.documentIds?.length
      ? filters.documentIds
      : null,
    filter_file_type: filters.fileType || null,
    filter_created_after: filters.createdAfter || null,
    filter_created_before: filters.createdBefore || null,
    filter_keyword: filters.keyword || null,
  });

  if (error) {
    throw new Error(`Hybrid search failed: ${error.message}`);
  }

  return (data || []).map(
    (row: Record<string, unknown>): SearchResultV2 => ({
      content: row.content as string,
      documentId: row.document_id as string,
      filename: row.filename as string,
      chunkIndex: row.chunk_index as number,
      score: row.similarity as number,
      chunkType: ((row.chunk_type as string) ||
        "paragraph") as SearchResultV2["chunkType"],
      sectionTitle: (row.section_title as string) || "",
      summary: (row.summary as string) || "",
      keywords: (row.keywords as string[]) || [],
      hypotheticalQuestions: (row.hypothetical_questions as string[]) || [],
    })
  );
}

/**
 * Check if any filters are actually set (non-empty).
 */
export function hasActiveFilters(filters?: SearchFilters): boolean {
  if (!filters) return false;
  return !!(
    (filters.documentIds && filters.documentIds.length > 0) ||
    filters.fileType ||
    filters.createdAfter ||
    filters.createdBefore ||
    filters.keyword
  );
}
