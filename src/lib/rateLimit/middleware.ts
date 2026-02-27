import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import {
  RateLimitResult,
  rateLimitConfigs,
  checkRateLimit,
  rateLimitExceededResponse,
  getRateLimitHeaders,
} from "./index";
import { createServiceClient } from "@/lib/supabase/server";

// In-memory cache of user IDs that have been synced this server process.
// Prevents repeated Supabase upserts on every request.
// Capped to prevent unbounded memory growth.
const SYNCED_USERS_MAX = 10_000;
const syncedUsers = new Set<string>();

/**
 * Ensure the authenticated user exists in the Supabase users table.
 * Handles the case where the Clerk webhook hasn't fired (e.g., localhost dev).
 */
async function ensureUserExists(userId: string): Promise<void> {
  if (syncedUsers.has(userId)) return;

  try {
    const user = await currentUser();
    if (!user) return;

    const email = user.emailAddresses?.[0]?.emailAddress;
    if (!email) return;

    const supabase = createServiceClient();
    await supabase.from("users").upsert(
      { id: userId, email, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    // Evict all entries when cache is full (forces re-sync but prevents memory leak)
    if (syncedUsers.size >= SYNCED_USERS_MAX) {
      syncedUsers.clear();
    }
    syncedUsers.add(userId);
  } catch {
    // Non-fatal — log and continue. The FK error will surface naturally if this fails.
    const { logger } = await import("@/lib/utils/logger");
    logger.warn(`Failed to auto-sync user ${userId} to Supabase`, "auth");
  }
}

export type RateLimitType = "chat" | "search" | "upload" | "process" | "general";

interface RateLimitCheck {
  success: boolean;
  userId: string | null;
  result: RateLimitResult | null;
  errorResponse: Response | null;
}

/**
 * Check rate limit for an authenticated request
 */
export async function checkRequestRateLimit(
  request: NextRequest,
  type: RateLimitType = "general"
): Promise<RateLimitCheck> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      userId: null,
      result: null,
      errorResponse: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Ensure the user record exists in Supabase (handles missing webhook sync)
  await ensureUserExists(userId);

  // Create unique key combining userId and endpoint type
  const rateLimitKey = `${userId}:${type}`;
  const config = rateLimitConfigs[type] || rateLimitConfigs.general;
  const result = await checkRateLimit(rateLimitKey, config);

  if (!result.success) {
    return {
      success: false,
      userId,
      result,
      errorResponse: rateLimitExceededResponse(result),
    };
  }

  return {
    success: true,
    userId,
    result,
    errorResponse: null,
  };
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  const rateLimitHeaders = getRateLimitHeaders(result);

  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
