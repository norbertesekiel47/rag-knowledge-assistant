import { LLMMessage, LLMProvider } from "@/lib/llm/types";
import { RAGContextV2, buildRAGPromptV2 } from "@/lib/llm";
import { EmbeddingProvider } from "@/lib/embeddings";
import type { SearchFilters, SearchResultV2 } from "@/lib/processing/types";
import { classifyQuery, QueryCategory } from "./classifier";
import { decomposeQuery } from "./decomposer";
import { retrieveTool } from "./tools";
import { CONVERSATIONAL_SYSTEM_PROMPT, buildComplexRAGPrompt } from "./prompts";
import { logger } from "@/lib/utils/logger";

export interface OrchestrationMetadata {
  queryCategory: QueryCategory;
  reasoning: string;
  subQueries?: string[];
  totalChunksRetrieved: number;
  toolsUsed: string[];
  reasoningTimeMs: number;
}

export interface OrchestrationResult {
  contexts: RAGContextV2[];
  systemPrompt: string;
  metadata: OrchestrationMetadata;
}

interface OrchestrateParams {
  query: string;
  userId: string;
  provider: LLMProvider;
  embeddingProvider: EmbeddingProvider;
  conversationHistory: LLMMessage[];
  filters?: SearchFilters;
}

const MAX_TOTAL_CHUNKS = 8;

/**
 * Central orchestration: classify → route → retrieve → build prompt.
 * Replaces the inline retrieval logic in the chat route.
 */
export async function orchestrate(
  params: OrchestrateParams
): Promise<OrchestrationResult> {
  const { query, userId, embeddingProvider, conversationHistory, filters } = params;
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  // Step 1: Classify the query
  toolsUsed.push("classifier");
  const classification = await classifyQuery(query, conversationHistory);

  logger.info(
    `Query classified as "${classification.category}": ${classification.reasoning}`,
    "reasoning"
  );

  // Step 2: Route based on classification
  switch (classification.category) {
    case "conversational":
      return handleConversational(classification, startTime, toolsUsed);

    case "simple":
      return handleSimple(
        query, userId, embeddingProvider, filters,
        classification, startTime, toolsUsed
      );

    case "complex":
      return handleComplex(
        query, userId, embeddingProvider, filters,
        classification, startTime, toolsUsed
      );

    default:
      // Shouldn't happen, but fallback to simple
      return handleSimple(
        query, userId, embeddingProvider, filters,
        classification, startTime, toolsUsed
      );
  }
}

function handleConversational(
  classification: { category: QueryCategory; reasoning: string },
  startTime: number,
  toolsUsed: string[]
): OrchestrationResult {
  return {
    contexts: [],
    systemPrompt: CONVERSATIONAL_SYSTEM_PROMPT,
    metadata: {
      queryCategory: classification.category,
      reasoning: classification.reasoning,
      totalChunksRetrieved: 0,
      toolsUsed,
      reasoningTimeMs: Date.now() - startTime,
    },
  };
}

async function handleSimple(
  query: string,
  userId: string,
  embeddingProvider: EmbeddingProvider,
  filters: SearchFilters | undefined,
  classification: { category: QueryCategory; reasoning: string },
  startTime: number,
  toolsUsed: string[]
): Promise<OrchestrationResult> {
  toolsUsed.push("retrieve");

  const results = await retrieveTool({
    query,
    userId,
    embeddingProvider,
    filters,
    limit: 5,
  });

  const v2Contexts = resultsToContexts(results);
  const systemPrompt = buildRAGPromptV2(v2Contexts);

  return {
    contexts: v2Contexts,
    systemPrompt,
    metadata: {
      queryCategory: classification.category,
      reasoning: classification.reasoning,
      totalChunksRetrieved: results.length,
      toolsUsed,
      reasoningTimeMs: Date.now() - startTime,
    },
  };
}

async function handleComplex(
  query: string,
  userId: string,
  embeddingProvider: EmbeddingProvider,
  filters: SearchFilters | undefined,
  classification: { category: QueryCategory; reasoning: string },
  startTime: number,
  toolsUsed: string[]
): Promise<OrchestrationResult> {
  // Step 1: Decompose the query
  toolsUsed.push("decomposer");
  const decomposition = await decomposeQuery(query);

  logger.info(
    `Decomposed into ${decomposition.subQueries.length} sub-queries (${decomposition.strategy}): ${JSON.stringify(decomposition.subQueries)}`,
    "reasoning"
  );

  // Step 2: Execute sub-queries
  toolsUsed.push("retrieve");
  const allResults: { subQuery: string; results: SearchResultV2[] }[] = [];

  if (decomposition.strategy === "parallel") {
    // Run all sub-queries in parallel
    const promises = decomposition.subQueries.map(async (subQuery) => {
      const results = await retrieveTool({
        query: subQuery,
        userId,
        embeddingProvider,
        filters,
        limit: 5,
      });
      return { subQuery, results };
    });
    allResults.push(...(await Promise.all(promises)));
  } else {
    // Run sequentially
    for (const subQuery of decomposition.subQueries) {
      const results = await retrieveTool({
        query: subQuery,
        userId,
        embeddingProvider,
        filters,
        limit: 5,
      });
      allResults.push({ subQuery, results });
    }
  }

  // Step 3: Deduplicate results
  const deduped = deduplicateResults(allResults);

  // Step 4: Cap at MAX_TOTAL_CHUNKS
  const capped = deduped.slice(0, MAX_TOTAL_CHUNKS);

  // Step 5: Build enriched system prompt with synthesis instruction
  const enrichedContexts = capped.map((r) => ({
    content: r.content,
    filename: r.filename,
    sectionTitle: r.sectionTitle,
    summary: r.summary,
    chunkType: r.chunkType,
    score: r.score,
    subQuery: r.subQuery,
  }));

  const systemPrompt = buildComplexRAGPrompt(
    enrichedContexts,
    decomposition.synthesisInstruction
  );

  const v2Contexts = resultsToContexts(capped);

  return {
    contexts: v2Contexts,
    systemPrompt,
    metadata: {
      queryCategory: classification.category,
      reasoning: classification.reasoning,
      subQueries: decomposition.subQueries,
      totalChunksRetrieved: capped.length,
      toolsUsed,
      reasoningTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Deduplicate results across sub-queries.
 * Keep the instance with the highest score. Preserve sub-query annotation.
 */
function deduplicateResults(
  subQueryResults: { subQuery: string; results: SearchResultV2[] }[]
): (SearchResultV2 & { subQuery: string })[] {
  const seen = new Map<string, SearchResultV2 & { subQuery: string }>();

  for (const { subQuery, results } of subQueryResults) {
    for (const result of results) {
      const key = `${result.documentId}:${result.chunkIndex}`;
      const existing = seen.get(key);

      if (!existing || result.score > existing.score) {
        seen.set(key, { ...result, subQuery });
      }
    }
  }

  // Sort by score descending
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

/**
 * Convert SearchResultV2[] to RAGContextV2[] for prompt building.
 */
function resultsToContexts(results: SearchResultV2[]): RAGContextV2[] {
  return results.map((r) => ({
    content: r.content,
    documentId: r.documentId,
    filename: r.filename,
    chunkIndex: r.chunkIndex,
    score: r.score,
    sectionTitle: r.sectionTitle,
    summary: r.summary,
    chunkType: r.chunkType,
  }));
}
