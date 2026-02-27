import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export interface ChunkFeedbackScore {
  documentId: string;
  chunkIndex: number;
  normalizedScore: number; // -1.0 to 1.0
  totalCount: number;
}

/**
 * Get aggregated feedback scores for specific chunks, for a given user.
 * Queries the chunk_feedback_scores view for efficient lookup.
 * Returns a Map keyed by "documentId:chunkIndex".
 */
export async function getChunkFeedbackScores(
  userId: string,
  chunks: { documentId: string; chunkIndex: number }[]
): Promise<Map<string, ChunkFeedbackScore>> {
  const scoreMap = new Map<string, ChunkFeedbackScore>();

  if (chunks.length === 0) return scoreMap;

  try {
    const supabase = createServiceClient();

    // Get unique document IDs to narrow the query
    const docIds = [...new Set(chunks.map((c) => c.documentId))];

    const { data, error } = await supabase
      .from("chunk_feedback_scores")
      .select("document_id, chunk_index, positive_count, negative_count, total_count, normalized_score")
      .eq("user_id", userId)
      .in("document_id", docIds);

    if (error || !data) return scoreMap;

    for (const row of data) {
      const key = `${row.document_id}:${row.chunk_index}`;
      scoreMap.set(key, {
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        normalizedScore: row.normalized_score ?? 0,
        totalCount: row.total_count ?? 0,
      });
    }
  } catch (error) {
    logger.error("Failed to fetch chunk feedback scores", "feedback", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
  }

  return scoreMap;
}
