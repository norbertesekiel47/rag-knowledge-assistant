import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Analytics</h1>
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
