import { callLLM } from "@/lib/llm";
import { LLMMessage } from "@/lib/llm/types";
import { CLASSIFIER_SYSTEM_PROMPT, buildClassifierUserPrompt } from "./prompts";
import { cacheGet, cacheSet, classificationCacheKey, hashQuery } from "@/lib/redis/cache";
import { logger } from "@/lib/utils/logger";

export type QueryCategory = "simple" | "complex" | "conversational";

export interface ClassificationResult {
  category: QueryCategory;
  reasoning: string;
  suggestedApproach: string;
}

/**
 * Classify a user query as simple, complex, or conversational.
 * Uses llama-3.1-8b-instant for speed. Falls back to "simple" on failure.
 */
export async function classifyQuery(
  query: string,
  conversationHistory: LLMMessage[]
): Promise<ClassificationResult> {
  // Check cache (keyed on query + history length for context sensitivity)
  const cacheKey = classificationCacheKey(
    hashQuery(query + ":" + conversationHistory.length)
  );
  const cached = await cacheGet<ClassificationResult>(cacheKey);
  if (cached) return cached;

  try {
    const userPrompt = buildClassifierUserPrompt(query, conversationHistory);

    const response = await callLLM(CLASSIFIER_SYSTEM_PROMPT, userPrompt, {
      temperature: 0,
      maxTokens: 256,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in classifier response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const validCategories: QueryCategory[] = ["simple", "complex", "conversational"];
    if (!validCategories.includes(parsed.category)) {
      throw new Error(`Invalid category: ${parsed.category}`);
    }

    const result: ClassificationResult = {
      category: parsed.category,
      reasoning: parsed.reasoning || "",
      suggestedApproach: parsed.suggestedApproach || "",
    };

    // Cache for 1 hour
    await cacheSet(cacheKey, result, 3600);
    return result;
  } catch (error) {
    logger.error("Query classification failed, defaulting to simple", "reasoning", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return {
      category: "simple",
      reasoning: "Classification failed, using default",
      suggestedApproach: "standard retrieval",
    };
  }
}
