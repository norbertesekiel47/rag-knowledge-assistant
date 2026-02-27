import Groq from "groq-sdk";
import type { ChunkFeedbackScore } from "@/lib/feedback/scores";
import { logger } from "@/lib/utils/logger";

export interface RerankInput {
  content: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

export interface RerankResult<T extends RerankInput> {
  results: T[];
  reranked: boolean;
}

/**
 * Re-rank search results using an LLM to reorder by relevance to the query.
 * Uses llama-3.1-8b-instant for speed. Falls back to original order on failure.
 * Optionally blends in feedback scores to boost/demote chunks based on user history.
 */
export async function rerankResults<T extends RerankInput>(
  query: string,
  results: T[],
  topN: number = 5,
  feedbackScores?: Map<string, ChunkFeedbackScore>
): Promise<RerankResult<T>> {
  if (results.length <= 1) {
    return { results: results.slice(0, topN), reranked: false };
  }

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const passages = results
      .map(
        (r, i) =>
          `[${i}] (${r.filename}) ${r.content.substring(0, 300)}`
      )
      .join("\n\n");

    const prompt = `Given the user query and the following passages, rank the passages by relevance to the query.
Return a JSON object with a "ranking" key containing an array of passage indices, most relevant first.

Query: "${query}"

Passages:
${passages}

Respond with ONLY valid JSON like: {"ranking": [2, 0, 4, 1, 3]}`;

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are a relevance scoring assistant. You ONLY output valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 256,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in rerank response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rankedIndices: number[] = parsed.ranking;

    if (!Array.isArray(rankedIndices)) {
      throw new Error("Invalid rerank response: missing ranking array");
    }

    // Reorder results based on LLM ranking, take topN
    const reranked = rankedIndices
      .filter((idx) => idx >= 0 && idx < results.length)
      .slice(0, topN)
      .map((idx, newRank) => ({
        ...results[idx],
        score: 1 - newRank / Math.max(rankedIndices.length, 1),
      }));

    // If reranking produced fewer results than available, append remaining
    if (reranked.length < topN) {
      const usedIndices = new Set(
        rankedIndices.filter((idx) => idx >= 0 && idx < results.length)
      );
      for (const [idx, result] of results.entries()) {
        if (reranked.length >= topN) break;
        if (!usedIndices.has(idx)) {
          reranked.push({ ...result, score: 0 });
        }
      }
    }

    // Blend feedback scores (post-rerank adjustment)
    if (feedbackScores && feedbackScores.size > 0) {
      const FEEDBACK_WEIGHT = 0.15;

      for (const result of reranked) {
        const key = `${result.documentId}:${result.chunkIndex}`;
        const feedback = feedbackScores.get(key);

        if (feedback && feedback.totalCount >= 2) {
          const adjustment = feedback.normalizedScore * FEEDBACK_WEIGHT;
          result.score = Math.max(0, Math.min(1, result.score + adjustment));
        }
      }

      // Re-sort after feedback adjustment
      reranked.sort((a, b) => b.score - a.score);
    }

    logger.info(
      `Re-ranked ${results.length} results → top ${reranked.length} for query: "${query.substring(0, 50)}..."`,
      "reranker"
    );

    return { results: reranked, reranked: true };
  } catch (error) {
    logger.error("Re-ranking failed, using original order", "reranker", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return {
      results: results.slice(0, topN),
      reranked: false,
    };
  }
}
