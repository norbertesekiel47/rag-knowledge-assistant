import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isRedisConfigured, getRedis } from "@/lib/redis/client";

export const runtime = "nodejs";

interface ServiceStatus {
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

export async function GET() {
  const results: Record<string, ServiceStatus> = {};
  let allHealthy = true;

  // Check Supabase
  const supabaseStart = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    if (error) throw error;
    results.supabase = { status: "ok", latencyMs: Date.now() - supabaseStart };
  } catch (err) {
    allHealthy = false;
    results.supabase = {
      status: "error",
      latencyMs: Date.now() - supabaseStart,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  // Check Redis (optional)
  if (isRedisConfigured()) {
    const redisStart = Date.now();
    try {
      const redis = getRedis();
      await redis.set("health:ping", "pong", { ex: 10 });
      const val = await redis.get("health:ping");
      if (val !== "pong") throw new Error("Unexpected response");
      results.redis = { status: "ok", latencyMs: Date.now() - redisStart };
    } catch (err) {
      allHealthy = false;
      results.redis = {
        status: "error",
        latencyMs: Date.now() - redisStart,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  } else {
    results.redis = { status: "ok", latencyMs: 0, error: "Not configured (using in-memory fallback)" };
  }

  // Check Weaviate
  const weaviateStart = Date.now();
  try {
    const { getWeaviateClient } = await import("@/lib/weaviate/client");
    const client = await getWeaviateClient();
    const ready = await client.isReady();
    if (!ready) throw new Error("Weaviate not ready");
    results.weaviate = { status: "ok", latencyMs: Date.now() - weaviateStart };
  } catch (err) {
    allHealthy = false;
    results.weaviate = {
      status: "error",
      latencyMs: Date.now() - weaviateStart,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: results,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
