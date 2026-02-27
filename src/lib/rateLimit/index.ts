import { getRedis, isRedisConfigured } from "@/lib/redis/client";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// ── In-memory fallback (used when Redis is not configured) ───────

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  if (record.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  record.count++;
  rateLimitStore.set(identifier, record);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - record.count,
    reset: record.resetTime,
  };
}

// ── Redis-backed rate limiting ───────────────────────────────────

async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis();
  const key = `ratelimit:${identifier}`;
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  try {
    // Atomic increment + set TTL if new key
    const count = await redis.incr(key);

    if (count === 1) {
      // First request in window — set expiry
      await redis.expire(key, windowSeconds);
    }

    // Get TTL to compute reset timestamp
    const ttl = await redis.ttl(key);
    const reset = Date.now() + ttl * 1000;

    if (count > config.maxRequests) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        reset,
      };
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - count,
      reset,
    };
  } catch (error) {
    // Redis failure — fall back to in-memory
    const { logger } = await import("@/lib/utils/logger");
    logger.warn("Redis rate limit error, falling back to in-memory", "rateLimit", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return checkRateLimitInMemory(identifier, config);
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Check rate limit for a given identifier.
 * Uses Redis when configured, otherwise falls back to in-memory.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isRedisConfigured()) {
    return checkRateLimitRedis(identifier, config);
  }
  return checkRateLimitInMemory(identifier, config);
}

// Pre-configured rate limit configs
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  chat: { maxRequests: 20, windowMs: 60 * 1000 },
  search: { maxRequests: 30, windowMs: 60 * 1000 },
  upload: { maxRequests: 10, windowMs: 60 * 1000 },
  process: { maxRequests: 5, windowMs: 60 * 1000 },
  general: { maxRequests: 100, windowMs: 60 * 1000 },
};

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * Create rate limit error response
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        ...getRateLimitHeaders(result),
      },
    }
  );
}
