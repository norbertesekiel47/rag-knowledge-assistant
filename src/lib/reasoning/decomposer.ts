import { callLLM } from "@/lib/llm";
import { DECOMPOSER_SYSTEM_PROMPT, buildDecomposerUserPrompt } from "./prompts";
import { logger } from "@/lib/utils/logger";

export interface DecompositionResult {
  subQueries: string[];
  strategy: "parallel" | "sequential";
  synthesisInstruction: string;
}

/**
 * Decompose a complex query into 2-4 focused sub-queries.
 * Falls back to treating the original query as a single sub-query on failure.
 */
export async function decomposeQuery(
  query: string
): Promise<DecompositionResult> {
  try {
    const userPrompt = buildDecomposerUserPrompt(query);

    const response = await callLLM(DECOMPOSER_SYSTEM_PROMPT, userPrompt, {
      temperature: 0,
      maxTokens: 512,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in decomposer response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.subQueries) || parsed.subQueries.length === 0) {
      throw new Error("Invalid sub-queries array");
    }

    // Cap at 4 sub-queries
    const subQueries = parsed.subQueries.slice(0, 4) as string[];

    return {
      subQueries,
      strategy: parsed.strategy === "sequential" ? "sequential" : "parallel",
      synthesisInstruction:
        parsed.synthesisInstruction || "Synthesize the information from all retrieved sources to answer the query comprehensively.",
    };
  } catch (error) {
    logger.error("Query decomposition failed, using original query", "reasoning", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return {
      subQueries: [query],
      strategy: "parallel",
      synthesisInstruction: "Answer the query based on the retrieved context.",
    };
  }
}
