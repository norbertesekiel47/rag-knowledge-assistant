import { searchChunks, searchChunksV2 } from "@/lib/weaviate/vectors";
import { checkCollectionExists } from "@/lib/weaviate/schema";
import { EmbeddingProvider, getCollectionName } from "@/lib/embeddings";
import { hybridSearch, hasActiveFilters } from "@/lib/supabase/hybridSearch";
import { rerankResults } from "@/lib/llm/reranker";
import { getChunkFeedbackScores } from "@/lib/feedback/scores";
import { callLLM } from "@/lib/llm";
import type { SearchFilters, SearchResultV2 } from "@/lib/processing/types";
import {
  SUMMARIZER_SYSTEM_PROMPT,
  COMPARATOR_SYSTEM_PROMPT,
  buildSummarizerUserPrompt,
  buildComparatorUserPrompt,
} from "./prompts";

/**
 * Retrieval tool — wraps existing search infrastructure.
 * Uses hybrid search when filters are active, Weaviate otherwise.
 * Always applies re-ranking.
 */
export async function retrieveTool(params: {
  query: string;
  userId: string;
  embeddingProvider: EmbeddingProvider;
  filters?: SearchFilters;
  limit?: number;
}): Promise<SearchResultV2[]> {
  const { query, userId, embeddingProvider, filters, limit = 5 } = params;
  const fetchLimit = Math.min(limit * 2, 20);

  let results: SearchResultV2[];

  if (hasActiveFilters(filters)) {
    results = await hybridSearch({
      query,
      userId,
      provider: embeddingProvider,
      filters,
      limit: fetchLimit,
    });
  } else {
    const v2CollectionName = getCollectionName(embeddingProvider, 2);
    const hasV2 = await checkCollectionExists(v2CollectionName);

    if (hasV2) {
      results = await searchChunksV2(query, userId, embeddingProvider, fetchLimit);
    } else {
      const v1Results = await searchChunks(query, userId, embeddingProvider, fetchLimit);
      results = v1Results.map((r) => ({
        ...r,
        chunkType: "paragraph" as const,
        sectionTitle: "",
        summary: "",
        keywords: [] as string[],
        hypotheticalQuestions: [] as string[],
      }));
    }
  }

  // Re-rank results with feedback-aware scoring
  if (results.length > 1) {
    const feedbackScores = await getChunkFeedbackScores(
      userId,
      results.map((r) => ({ documentId: r.documentId, chunkIndex: r.chunkIndex }))
    );

    const { results: reranked } = await rerankResults(query, results, limit, feedbackScores);
    return reranked as SearchResultV2[];
  }

  return results.slice(0, limit);
}

/**
 * Summarization tool — condense retrieved chunks into a focused summary.
 */
export async function summarizeTool(params: {
  chunks: SearchResultV2[];
  focus: string;
}): Promise<string> {
  const { chunks, focus } = params;

  if (chunks.length === 0) {
    return "No relevant content found to summarize.";
  }

  const userPrompt = buildSummarizerUserPrompt(
    chunks.map((c) => ({ content: c.content, filename: c.filename })),
    focus
  );

  return callLLM(SUMMARIZER_SYSTEM_PROMPT, userPrompt, {
    maxTokens: 1024,
    temperature: 0.1,
  });
}

/**
 * Comparison tool — compare chunks from different source groups.
 */
export async function compareTool(params: {
  groupA: { label: string; chunks: SearchResultV2[] };
  groupB: { label: string; chunks: SearchResultV2[] };
  criteria: string;
}): Promise<string> {
  const { groupA, groupB, criteria } = params;

  const userPrompt = buildComparatorUserPrompt(
    {
      label: groupA.label,
      chunks: groupA.chunks.map((c) => ({ content: c.content, filename: c.filename })),
    },
    {
      label: groupB.label,
      chunks: groupB.chunks.map((c) => ({ content: c.content, filename: c.filename })),
    },
    criteria
  );

  return callLLM(COMPARATOR_SYSTEM_PROMPT, userPrompt, {
    maxTokens: 1024,
    temperature: 0.1,
  });
}
