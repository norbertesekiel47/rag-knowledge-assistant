import { createServiceClient } from "@/lib/supabase/server";
import { getEvaluationSummary } from "@/lib/validation/store";
import { logger } from "@/lib/utils/logger";

export type { EvaluationSummary } from "@/lib/validation/store";
export { getEvaluationSummary };

export interface QueryAnalytics {
  userId: string;
  sessionId?: string;
  queryText: string;
  model: string;
  embeddingProvider: string;
  responseTimeMs: number;
  sources: {
    documentId: string;
    chunkIndex: number;
    relevanceScore: number;
  }[];
}

/**
 * Track a chat query and its sources
 */
export async function trackQuery(data: QueryAnalytics): Promise<void> {
  const supabase = createServiceClient();

  try {
    // 1. Insert query record
    const { data: queryRecord, error: queryError } = await supabase
      .from("analytics_queries")
      .insert({
        user_id: data.userId,
        session_id: data.sessionId || null,
        query_text: data.queryText.slice(0, 500), // Limit length
        model: data.model,
        embedding_provider: data.embeddingProvider,
        response_time_ms: data.responseTimeMs,
        sources_count: data.sources.length,
      })
      .select("id")
      .single();

    if (queryError) {
      logger.error("Error tracking query", "analytics", {
        error: { message: queryError.message },
      });
      return;
    }

    // 2. Insert document usage records
    if (data.sources.length > 0 && queryRecord) {
      const usageRecords = data.sources.map((source) => ({
        user_id: data.userId,
        document_id: source.documentId,
        query_id: queryRecord.id,
        chunk_index: source.chunkIndex,
        relevance_score: source.relevanceScore,
      }));

      const { error: usageError } = await supabase
        .from("analytics_document_usage")
        .insert(usageRecords);

      if (usageError) {
        logger.error("Error tracking document usage", "analytics", {
          error: { message: usageError.message },
        });
      }
    }

    // 3. Update daily stats
    await updateDailyStats(data.userId, data.model);
  } catch (error) {
    logger.error("Analytics tracking error", "analytics", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    // Don't throw - analytics should not break the main flow
  }
}

/**
 * Update daily aggregated stats
 */
async function updateDailyStats(userId: string, model: string): Promise<void> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Get existing stats for today
  const { data: existing } = await supabase
    .from("analytics_daily_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (existing) {
    // Update existing record
    const modelsUsed = existing.models_used || {};
    modelsUsed[model] = (modelsUsed[model] || 0) + 1;

    await supabase
      .from("analytics_daily_stats")
      .update({
        total_queries: existing.total_queries + 1,
        models_used: modelsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Create new record
    await supabase.from("analytics_daily_stats").insert({
      user_id: userId,
      date: today,
      total_queries: 1,
      models_used: { [model]: 1 },
    });
  }
}

export interface AnalyticsSummary {
  totalQueries: number;
  totalDocuments: number;
  avgResponseTime: number;
  queriesLast7Days: { date: string; count: number }[];
  topDocuments: { documentId: string; filename: string; usageCount: number }[];
  modelUsage: { model: string; count: number }[];
  recentQueries: { query: string; model: string; createdAt: string }[];
}

/**
 * Get analytics summary for a user
 */
export async function getAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
  const supabase = createServiceClient();

  // Get total queries
  const { count: totalQueries } = await supabase
    .from("analytics_queries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get total documents
  const { count: totalDocuments } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get average response time (capped at 10k rows for safety)
  const { data: avgData } = await supabase
    .from("analytics_queries")
    .select("response_time_ms")
    .eq("user_id", userId)
    .limit(10000);

  const avgResponseTime = avgData && avgData.length > 0
    ? Math.round(avgData.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / avgData.length)
    : 0;

  // Get queries last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: dailyStats } = await supabase
    .from("analytics_daily_stats")
    .select("date, total_queries")
    .eq("user_id", userId)
    .gte("date", sevenDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: true });

  const queriesLast7Days = dailyStats?.map((d) => ({
    date: d.date,
    count: d.total_queries,
  })) || [];

  // Get top documents by usage (capped at 500 rows for safety)
  const { data: topDocsData } = await supabase
    .from("analytics_document_usage")
    .select("document_id, documents(filename)")
    .eq("user_id", userId)
    .limit(500);

  const docCounts = new Map<string, { filename: string; count: number }>();
  topDocsData?.forEach((d) => {
    const docId = d.document_id;
    const filename = (d.documents as unknown as { filename: string } | null)?.filename || "Unknown";
    const existing = docCounts.get(docId);
    if (existing) {
      existing.count++;
    } else {
      docCounts.set(docId, { filename, count: 1 });
    }
  });

  const topDocuments = Array.from(docCounts.entries())
    .map(([documentId, { filename, count }]) => ({ documentId, filename, usageCount: count }))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 5);

  // Get model usage (capped at 365 rows for safety)
  const { data: modelData } = await supabase
    .from("analytics_daily_stats")
    .select("models_used")
    .eq("user_id", userId)
    .limit(365);

  const modelCounts = new Map<string, number>();
  modelData?.forEach((d) => {
    const models = d.models_used || {};
    Object.entries(models).forEach(([model, count]) => {
      modelCounts.set(model, (modelCounts.get(model) || 0) + (count as number));
    });
  });

  const modelUsage = Array.from(modelCounts.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  // Get recent queries
  const { data: recentData } = await supabase
    .from("analytics_queries")
    .select("query_text, model, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const recentQueries = recentData?.map((q) => ({
    query: q.query_text,
    model: q.model,
    createdAt: q.created_at,
  })) || [];

  return {
    totalQueries: totalQueries || 0,
    totalDocuments: totalDocuments || 0,
    avgResponseTime,
    queriesLast7Days,
    topDocuments,
    modelUsage,
    recentQueries,
  };
}