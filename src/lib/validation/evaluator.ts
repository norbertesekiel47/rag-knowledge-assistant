import { callLLM } from "@/lib/llm";
import type { RAGContextV2 } from "@/lib/llm";
import type { QueryCategory } from "@/lib/reasoning/classifier";
import {
  FAITHFULNESS_SYSTEM_PROMPT,
  RELEVANCE_SYSTEM_PROMPT,
  COMPLETENESS_SYSTEM_PROMPT,
  buildFaithfulnessUserPrompt,
  buildRelevanceUserPrompt,
  buildCompletenessUserPrompt,
} from "./prompts";
import { logger } from "@/lib/utils/logger";

interface CheckResult {
  score: number;
  issues: string[];
}

export interface EvaluationResult {
  faithfulness: CheckResult;
  relevance: CheckResult;
  completeness: CheckResult;
  overall: number;
}

const DEFAULT_CHECK: CheckResult = { score: 1.0, issues: [] };
const FAILED_CHECK: CheckResult = { score: 0, issues: ["evaluation failed"] };

/**
 * Parse a JSON check result from LLM response.
 */
function parseCheckResult(response: string): CheckResult {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found");

  const parsed = JSON.parse(jsonMatch[0]);
  const score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.filter((i: unknown) => typeof i === "string")
    : [];

  return { score, issues };
}

/**
 * Run a single validation check with graceful fallback.
 */
async function runCheck(
  systemPrompt: string,
  userPrompt: string
): Promise<CheckResult> {
  try {
    const response = await callLLM(systemPrompt, userPrompt, {
      temperature: 0,
      maxTokens: 256,
    });
    return parseCheckResult(response);
  } catch (error) {
    logger.error("Validation check failed", "validation", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return FAILED_CHECK;
  }
}

/**
 * Evaluate a response with 3 parallel checks: faithfulness, relevance, completeness.
 * Skips evaluation for conversational queries (no context to validate).
 */
export async function evaluateResponse(params: {
  query: string;
  response: string;
  contexts: RAGContextV2[];
  queryCategory: QueryCategory;
}): Promise<EvaluationResult> {
  const { query, response, contexts, queryCategory } = params;

  // Skip for conversational queries — no context to validate against
  if (queryCategory === "conversational" || contexts.length === 0) {
    return {
      faithfulness: DEFAULT_CHECK,
      relevance: DEFAULT_CHECK,
      completeness: DEFAULT_CHECK,
      overall: 1.0,
    };
  }

  const contextData = contexts.map((c) => ({
    content: c.content,
    filename: c.filename,
  }));

  // Run all 3 checks in parallel
  const [faithfulness, relevance, completeness] = await Promise.all([
    runCheck(
      FAITHFULNESS_SYSTEM_PROMPT,
      buildFaithfulnessUserPrompt(query, response, contextData)
    ),
    runCheck(
      RELEVANCE_SYSTEM_PROMPT,
      buildRelevanceUserPrompt(query, response)
    ),
    runCheck(
      COMPLETENESS_SYSTEM_PROMPT,
      buildCompletenessUserPrompt(query, response, contextData)
    ),
  ]);

  // Weighted average: faithfulness 40%, relevance 35%, completeness 25%
  const overall =
    faithfulness.score * 0.4 +
    relevance.score * 0.35 +
    completeness.score * 0.25;

  logger.info(
    `Evaluation scores — faithfulness: ${faithfulness.score.toFixed(2)}, ` +
    `relevance: ${relevance.score.toFixed(2)}, completeness: ${completeness.score.toFixed(2)}, ` +
    `overall: ${overall.toFixed(2)}`,
    "validation"
  );

  return { faithfulness, relevance, completeness, overall };
}
