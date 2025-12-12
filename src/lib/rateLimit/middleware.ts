import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import {
  RateLimitResult,
  rateLimiters,
  rateLimitExceededResponse,
  getRateLimitHeaders,
} from "./index";

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

  // Create unique key combining userId and endpoint type
  const rateLimitKey = `${userId}:${type}`;
  const rateLimiter = rateLimiters[type];
  const result = rateLimiter(rateLimitKey);

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