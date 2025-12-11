"use client";

import { useState, useEffect } from "react";

interface AnalyticsSummary {
  totalQueries: number;
  totalDocuments: number;
  avgResponseTime: number;
  queriesLast7Days: { date: string; count: number }[];
  topDocuments: { documentId: string; filename: string; usageCount: number }[];
  modelUsage: { model: string; count: number }[];
  recentQueries: { query: string; model: string; createdAt: string }[];
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
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
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
          icon="💬"
          color="blue"
        />
        <StatCard
          title="Documents"
          value={analytics.totalDocuments}
          icon="📄"
          color="green"
        />
        <StatCard
          title="Avg Response Time"
          value={`${analytics.avgResponseTime}ms`}
          icon="⚡"
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Queries Last 7 Days */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            Queries - Last 7 Days
          </h3>
          {analytics.queriesLast7Days.length > 0 ? (
            <div className="flex items-end space-x-2 h-32">
              {analytics.queriesLast7Days.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all duration-300"
                    style={{
                      height: `${(day.count / maxQueries) * 100}%`,
                      minHeight: day.count > 0 ? "4px" : "0",
                    }}
                  />
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </span>
                  <span className="text-xs font-medium text-gray-700">
                    {day.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              No data yet
            </p>
          )}
        </div>

        {/* Model Usage */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Model Usage</h3>
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
                      <span className="text-gray-700">{model.model}</span>
                      <span className="text-gray-500">
                        {model.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-linear-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              No data yet
            </p>
          )}
        </div>
      </div>

      {/* Top Documents */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Most Referenced Documents
        </h3>
        {analytics.topDocuments.length > 0 ? (
          <div className="space-y-2">
            {analytics.topDocuments.map((doc, index) => (
              <div
                key={doc.documentId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center space-x-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-700 truncate max-w-xs">
                    {doc.filename}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {doc.usageCount} references
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            No documents referenced yet
          </p>
        )}
      </div>

      {/* Recent Queries */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Recent Queries
        </h3>
        {analytics.recentQueries.length > 0 ? (
          <div className="space-y-2">
            {analytics.recentQueries.map((query, index) => (
              <div
                key={index}
                className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{query.query}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(query.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  {query.model}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            No queries yet
          </p>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: "blue" | "green" | "purple";
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}