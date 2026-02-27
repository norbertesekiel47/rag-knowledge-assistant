import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { searchChunks, searchChunksV2 } from "@/lib/weaviate/vectors";
import { checkCollectionExists } from "@/lib/weaviate/schema";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER, getCollectionName } from "@/lib/embeddings";
import { hybridSearch, hasActiveFilters } from "@/lib/supabase/hybridSearch";
import { rerankResults } from "@/lib/llm/reranker";
import { INPUT_LIMITS } from "@/lib/security/sanitize";
import type { SearchFilters } from "@/lib/processing/types";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      query,
      limit = 5,
      embeddingProvider = DEFAULT_EMBEDDING_PROVIDER,
      filters,
      rerank = true,
    } = body as {
      query: string;
      limit?: number;
      embeddingProvider?: EmbeddingProvider;
      filters?: SearchFilters;
      rerank?: boolean;
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (query.trim().length === 0) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }

    if (query.length > INPUT_LIMITS.QUERY_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Query exceeds maximum length of ${INPUT_LIMITS.QUERY_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    const effectiveLimit = Math.min(limit, 20);
    // Fetch more results for re-ranking, then trim to requested limit
    const fetchLimit = rerank ? Math.min(effectiveLimit * 2, 20) : effectiveLimit;

    let results;
    let searchMethod: string;

    if (hasActiveFilters(filters)) {
      // Use pgvector hybrid search with filters
      results = await hybridSearch({
        query,
        userId,
        provider: embeddingProvider as EmbeddingProvider,
        filters,
        limit: fetchLimit,
      });
      searchMethod = "hybrid";
    } else {
      // Use Weaviate (V2 first, fallback to V1)
      const v2CollectionName = getCollectionName(embeddingProvider as EmbeddingProvider, 2);
      const hasV2 = await checkCollectionExists(v2CollectionName);

      if (hasV2) {
        results = await searchChunksV2(
          query,
          userId,
          embeddingProvider as EmbeddingProvider,
          fetchLimit
        );
      } else {
        const v1Results = await searchChunks(
          query,
          userId,
          embeddingProvider as EmbeddingProvider,
          fetchLimit
        );
        // Map V1 results to V2 format for consistency
        results = v1Results.map((r) => ({
          ...r,
          chunkType: "paragraph" as const,
          sectionTitle: "",
          summary: "",
          keywords: [] as string[],
          hypotheticalQuestions: [] as string[],
        }));
      }
      searchMethod = hasV2 ? "weaviate-v2" : "weaviate-v1";
    }

    // Apply re-ranking if enabled and we have results
    let reranked = false;
    if (rerank && results.length > 1) {
      const rerankResult = await rerankResults(query, results, effectiveLimit);
      results = rerankResult.results as typeof results;
      reranked = rerankResult.reranked;
    } else {
      results = results.slice(0, effectiveLimit);
    }

    return NextResponse.json({
      query,
      results,
      count: results.length,
      embeddingProvider,
      searchMethod,
      reranked,
    });
  } catch (error) {
    logger.error("Search error", "search", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
