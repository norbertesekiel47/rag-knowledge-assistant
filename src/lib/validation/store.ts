import { createServiceClient } from "@/lib/supabase/server";
import type { EvaluationResult } from "./evaluator";
import { logger } from "@/lib/utils/logger";

export interface EvaluationSummary {
  totalEvaluated: number;
  averageScores: {
    faithfulness: number;
    relevance: number;
    completeness: number;
    overall: number;
  };
  scoreDistribution: {
    good: number;   // > 0.8
    fair: number;    // 0.5 - 0.8
    poor: number;    // < 0.5
  };
  byCategory: {
    category: string;
    count: number;
    avgOverall: number;
  }[];
  recentLowScoring: {
    queryText: string;
    overallScore: number;
    model: string;
    createdAt: string;
  }[];
  qualityOverTime: {
    date: string;
    avgOverall: number;
    count: number;
  }[];
  byModel: {
    model: string;
    count: number;
    avgFaithfulness: number;
    avgRelevance: number;
    avgCompleteness: number;
    avgOverall: number;
  }[];
  feedbackSummary: {
    totalPositive: number;
    totalNegative: number;
    positiveRate: number;
  };
}

/**
 * Store evaluation results in Supabase.
 */
export async function storeEvaluation(params: {
  userId: string;
  queryText: string;
  responseText: string;
  model: string;
  queryCategory: string;
  evaluation: EvaluationResult;
}): Promise<void> {
  const { userId, queryText, responseText, model, queryCategory, evaluation } = params;

  const supabase = createServiceClient();

  // Collect all issues from all checks
  const allIssues = [
    ...evaluation.faithfulness.issues,
    ...evaluation.relevance.issues,
    ...evaluation.completeness.issues,
  ];

  const { error } = await supabase.from("evaluation_results").insert({
    user_id: userId,
    query_text: queryText.substring(0, 2000),
    response_text: responseText.substring(0, 5000),
    model,
    query_category: queryCategory,
    faithfulness_score: evaluation.faithfulness.score,
    relevance_score: evaluation.relevance.score,
    completeness_score: evaluation.completeness.score,
    overall_score: evaluation.overall,
    issues: allIssues,
    evaluation_metadata: {
      faithfulness_issues: evaluation.faithfulness.issues,
      relevance_issues: evaluation.relevance.issues,
      completeness_issues: evaluation.completeness.issues,
    },
  });

  if (error) {
    logger.error("Failed to store evaluation", "validation", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
  }
}

/**
 * Get evaluation summary for the analytics dashboard.
 */
export async function getEvaluationSummary(
  userId: string
): Promise<EvaluationSummary> {
  const supabase = createServiceClient();

  // Get all evaluations for user
  const { data: evaluations, error } = await supabase
    .from("evaluation_results")
    .select("faithfulness_score, relevance_score, completeness_score, overall_score, query_category, query_text, model, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !evaluations || evaluations.length === 0) {
    // Still fetch feedback even without evaluations
    const feedbackSummary = await getFeedbackSummary(supabase, userId);
    return {
      totalEvaluated: 0,
      averageScores: { faithfulness: 0, relevance: 0, completeness: 0, overall: 0 },
      scoreDistribution: { good: 0, fair: 0, poor: 0 },
      byCategory: [],
      recentLowScoring: [],
      qualityOverTime: [],
      byModel: [],
      feedbackSummary,
    };
  }

  const total = evaluations.length;

  // Average scores
  const avgFaithfulness = evaluations.reduce((sum, e) => sum + (e.faithfulness_score || 0), 0) / total;
  const avgRelevance = evaluations.reduce((sum, e) => sum + (e.relevance_score || 0), 0) / total;
  const avgCompleteness = evaluations.reduce((sum, e) => sum + (e.completeness_score || 0), 0) / total;
  const avgOverall = evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / total;

  // Score distribution
  let good = 0, fair = 0, poor = 0;
  for (const e of evaluations) {
    const score = e.overall_score || 0;
    if (score > 0.8) good++;
    else if (score >= 0.5) fair++;
    else poor++;
  }

  // By category
  const categoryMap = new Map<string, { count: number; totalScore: number }>();
  for (const e of evaluations) {
    const cat = e.query_category || "simple";
    const existing = categoryMap.get(cat) || { count: 0, totalScore: 0 };
    existing.count++;
    existing.totalScore += e.overall_score || 0;
    categoryMap.set(cat, existing);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    avgOverall: data.totalScore / data.count,
  }));

  // Recent low-scoring queries (bottom 5)
  const recentLowScoring = evaluations
    .filter((e) => (e.overall_score || 0) < 0.7)
    .slice(0, 5)
    .map((e) => ({
      queryText: e.query_text.substring(0, 100),
      overallScore: e.overall_score || 0,
      model: e.model,
      createdAt: e.created_at,
    }));

  // Quality over time (last 14 days)
  const dateMap = new Map<string, { totalScore: number; count: number }>();
  for (const e of evaluations) {
    const date = e.created_at.split("T")[0];
    const existing = dateMap.get(date) || { totalScore: 0, count: 0 };
    existing.totalScore += e.overall_score || 0;
    existing.count++;
    dateMap.set(date, existing);
  }
  const qualityOverTime = Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date,
      avgOverall: data.totalScore / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  // By model
  const modelMap = new Map<string, {
    count: number;
    totalFaithfulness: number;
    totalRelevance: number;
    totalCompleteness: number;
    totalOverall: number;
  }>();
  for (const e of evaluations) {
    const m = e.model || "unknown";
    const existing = modelMap.get(m) || {
      count: 0, totalFaithfulness: 0, totalRelevance: 0,
      totalCompleteness: 0, totalOverall: 0,
    };
    existing.count++;
    existing.totalFaithfulness += e.faithfulness_score || 0;
    existing.totalRelevance += e.relevance_score || 0;
    existing.totalCompleteness += e.completeness_score || 0;
    existing.totalOverall += e.overall_score || 0;
    modelMap.set(m, existing);
  }
  const byModel = Array.from(modelMap.entries()).map(([model, data]) => ({
    model,
    count: data.count,
    avgFaithfulness: data.totalFaithfulness / data.count,
    avgRelevance: data.totalRelevance / data.count,
    avgCompleteness: data.totalCompleteness / data.count,
    avgOverall: data.totalOverall / data.count,
  }));

  // Feedback summary
  const feedbackSummary = await getFeedbackSummary(supabase, userId);

  return {
    totalEvaluated: total,
    averageScores: {
      faithfulness: avgFaithfulness,
      relevance: avgRelevance,
      completeness: avgCompleteness,
      overall: avgOverall,
    },
    scoreDistribution: { good, fair, poor },
    byCategory,
    recentLowScoring,
    qualityOverTime,
    byModel,
    feedbackSummary,
  };
}

/**
 * Get feedback summary from message_feedback table.
 */
async function getFeedbackSummary(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<EvaluationSummary["feedbackSummary"]> {
  const { data: feedback } = await supabase
    .from("message_feedback")
    .select("feedback")
    .eq("user_id", userId);

  if (!feedback || feedback.length === 0) {
    return { totalPositive: 0, totalNegative: 0, positiveRate: 0 };
  }

  const totalPositive = feedback.filter((f) => f.feedback === "positive").length;
  const totalNegative = feedback.filter((f) => f.feedback === "negative").length;
  const totalFeedback = totalPositive + totalNegative;

  return {
    totalPositive,
    totalNegative,
    positiveRate: totalFeedback > 0 ? totalPositive / totalFeedback : 0,
  };
}
