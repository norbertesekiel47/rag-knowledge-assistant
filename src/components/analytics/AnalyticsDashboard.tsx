"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, FileText, Zap, ThumbsUp, ThumbsDown,
  TrendingUp, BarChart3, AlertTriangle,
} from "lucide-react";

interface EvaluationSummary {
  totalEvaluated: number;
  averageScores: {
    faithfulness: number;
    relevance: number;
    completeness: number;
    overall: number;
  };
  scoreDistribution: {
    good: number;
    fair: number;
    poor: number;
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

interface AnalyticsSummary {
  totalQueries: number;
  totalDocuments: number;
  avgResponseTime: number;
  queriesLast7Days: { date: string; count: number }[];
  topDocuments: { documentId: string; filename: string; usageCount: number }[];
  modelUsage: { model: string; count: number }[];
  recentQueries: { query: string; model: string; createdAt: string }[];
  evaluation?: EvaluationSummary;
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/analytics");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!analytics) return null;

  const maxQueries = Math.max(...analytics.queriesLast7Days.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Queries"
          value={analytics.totalQueries}
          icon={<MessageSquare className="w-6 h-6" />}
          color="primary"
        />
        <StatCard
          title="Documents"
          value={analytics.totalDocuments}
          icon={<FileText className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Avg Response Time"
          value={`${analytics.avgResponseTime}ms`}
          icon={<Zap className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Queries Last 7 Days */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">
              Queries - Last 7 Days
            </h3>
            {analytics.queriesLast7Days.length > 0 ? (
              <div className="flex items-end space-x-2 h-32">
                {analytics.queriesLast7Days.map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-[var(--gradient-start)] to-[var(--gradient-mid)] rounded-t transition-all duration-300"
                      style={{
                        height: `${(day.count / maxQueries) * 100}%`,
                        minHeight: day.count > 0 ? "4px" : "0",
                      }}
                    />
                    <span className="text-xs text-muted-foreground mt-1">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {day.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Model Usage */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">Model Usage</h3>
            {analytics.modelUsage.length > 0 ? (
              <div className="space-y-3">
                {analytics.modelUsage.map((model, index) => {
                  const total = analytics.modelUsage.reduce(
                    (sum, m) => sum + m.count,
                    0
                  );
                  const percentage = Math.round((model.count / total) * 100);
                  return (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">{model.model}</span>
                        <span className="text-muted-foreground">
                          {model.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Documents */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">
            Most Referenced Documents
          </h3>
          {analytics.topDocuments.length > 0 ? (
            <div className="space-y-2">
              {analytics.topDocuments.map((doc, index) => (
                <div
                  key={doc.documentId}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center justify-center w-6 h-6 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {index + 1}
                    </span>
                    <span className="text-sm text-foreground truncate max-w-xs">
                      {doc.filename}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {doc.usageCount} references
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No documents referenced yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Queries */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">
            Recent Queries
          </h3>
          {analytics.recentQueries.length > 0 ? (
            <div className="space-y-2">
              {analytics.recentQueries.map((query, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{query.query}</p>
                    <p className="text-xs text-muted-foreground/60">
                      {new Date(query.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="ml-2 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                    {query.model}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No queries yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Response Quality */}
      {analytics.evaluation && analytics.evaluation.totalEvaluated > 0 && (
        <QualityMetrics evaluation={analytics.evaluation} />
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "primary" | "green" | "purple";
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 border-primary/20 text-primary",
    green: "bg-green-500/10 border-green-500/20 text-green-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  };

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className={colorClasses[color].split(" ").slice(0, 1).join(" ") + " p-2 rounded-lg"}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ label, score, color }: { label: string; score: number; color: string }) {
  const percentage = Math.round(score * 100);
  const getScoreColor = () => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.5) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-2">
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className={color}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${percentage}, 100`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${getScoreColor()}`}>
          {percentage}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function QualityMetrics({ evaluation }: { evaluation: EvaluationSummary }) {
  const {
    averageScores, scoreDistribution, byCategory, recentLowScoring,
    totalEvaluated, qualityOverTime, byModel, feedbackSummary,
  } = evaluation;
  const total = scoreDistribution.good + scoreDistribution.fair + scoreDistribution.poor;

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Response Quality</h3>
          </div>
          <span className="text-xs text-muted-foreground">{totalEvaluated} evaluated</span>
        </div>

        {/* Score Gauges */}
        <div className="grid grid-cols-4 gap-2">
          <ScoreGauge label="Overall" score={averageScores.overall} color="text-primary" />
          <ScoreGauge label="Faithfulness" score={averageScores.faithfulness} color="text-green-400" />
          <ScoreGauge label="Relevance" score={averageScores.relevance} color="text-purple-400" />
          <ScoreGauge label="Completeness" score={averageScores.completeness} color="text-orange-400" />
        </div>

        {/* Score Distribution */}
        {total > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Score Distribution</p>
            <div className="flex rounded-full h-3 overflow-hidden bg-muted">
              {scoreDistribution.good > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${(scoreDistribution.good / total) * 100}%` }}
                  title={`Good: ${scoreDistribution.good}`}
                />
              )}
              {scoreDistribution.fair > 0 && (
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(scoreDistribution.fair / total) * 100}%` }}
                  title={`Fair: ${scoreDistribution.fair}`}
                />
              )}
              {scoreDistribution.poor > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(scoreDistribution.poor / total) * 100}%` }}
                  title={`Poor: ${scoreDistribution.poor}`}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Good ({scoreDistribution.good})</span>
              <span>Fair ({scoreDistribution.fair})</span>
              <span>Poor ({scoreDistribution.poor})</span>
            </div>
          </div>
        )}

        {/* By Category */}
        {byCategory.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Quality by Query Type</p>
            </div>
            <div className="space-y-1">
              {byCategory.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-xs">
                  <span className="text-foreground capitalize">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{cat.count} queries</span>
                    <span className={`font-medium ${cat.avgOverall >= 0.8 ? "text-green-400" : cat.avgOverall >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                      {Math.round(cat.avgOverall * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Low-Scoring */}
        {recentLowScoring.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <p className="text-xs text-muted-foreground">Flagged Responses (below 70%)</p>
            </div>
            <div className="space-y-1">
              {recentLowScoring.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-1 text-xs border-b border-border/30 last:border-0">
                  <span className="text-foreground truncate max-w-[200px]">{item.queryText}</span>
                  <span className="text-red-400 font-medium ml-2">
                    {Math.round(item.overallScore * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quality Over Time */}
        {qualityOverTime && qualityOverTime.length > 1 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quality Trend (Last 14 Days)</p>
            <div className="flex items-end gap-1 h-24">
              {qualityOverTime.map((day) => {
                const height = Math.max(day.avgOverall * 100, 4);
                const barColor = day.avgOverall >= 0.8
                  ? "bg-green-500" : day.avgOverall >= 0.5
                  ? "bg-yellow-500" : "bg-red-500";
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] text-muted-foreground mb-0.5">
                      {Math.round(day.avgOverall * 100)}
                    </span>
                    <div
                      className={`w-full rounded-t ${barColor} transition-all`}
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${Math.round(day.avgOverall * 100)}% (${day.count} queries)`}
                    />
                    <span className="text-[8px] text-muted-foreground/60 mt-0.5">
                      {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-Model Comparison */}
        {byModel && byModel.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quality by Model</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left py-1 font-medium">Model</th>
                    <th className="text-center py-1 font-medium">Faith.</th>
                    <th className="text-center py-1 font-medium">Relev.</th>
                    <th className="text-center py-1 font-medium">Comp.</th>
                    <th className="text-center py-1 font-medium">Overall</th>
                    <th className="text-right py-1 font-medium">N</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => (
                    <tr key={m.model} className="border-b border-border/30">
                      <td className="py-1.5 text-foreground">{m.model}</td>
                      <td className="text-center py-1.5">
                        <ScoreCell score={m.avgFaithfulness} />
                      </td>
                      <td className="text-center py-1.5">
                        <ScoreCell score={m.avgRelevance} />
                      </td>
                      <td className="text-center py-1.5">
                        <ScoreCell score={m.avgCompleteness} />
                      </td>
                      <td className="text-center py-1.5">
                        <ScoreCell score={m.avgOverall} />
                      </td>
                      <td className="text-right py-1.5 text-muted-foreground">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Feedback Stats */}
        {feedbackSummary && (feedbackSummary.totalPositive > 0 || feedbackSummary.totalNegative > 0) && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">User Feedback</p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-4 h-4 text-green-400" />
                <span className="text-foreground font-medium">{feedbackSummary.totalPositive}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="w-4 h-4 text-red-400" />
                <span className="text-foreground font-medium">{feedbackSummary.totalNegative}</span>
              </div>
              <span className="text-muted-foreground ml-auto">
                {Math.round(feedbackSummary.positiveRate * 100)}% positive
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCell({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? "text-green-400" : score >= 0.5 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-medium ${color}`}>{pct}%</span>;
}
