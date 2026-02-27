import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAnalyticsSummary, getEvaluationSummary } from "@/lib/analytics";
import { logger } from "@/lib/utils/logger";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [analytics, evaluation] = await Promise.all([
      getAnalyticsSummary(userId),
      getEvaluationSummary(userId),
    ]);

    return NextResponse.json({ ...analytics, evaluation });
  } catch (error) {
    logger.error("Analytics fetch error", "analytics", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
