import { getRedis, isRedisConfigured } from "./client";
import { logger } from "@/lib/utils/logger";

/**
 * Simple deterministic hash for cache keys.
 * Not cryptographic — just needs to be consistent and short.
 */
export function hashQuery(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get a cached value from Redis.
 * Returns null if Redis is not configured or key doesn't exist.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) return null;

  try {
    const redis = getRedis();
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (error) {
    logger.warn("Cache get error", "redis", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return null;
  }
}

/**
 * Set a cached value in Redis with TTL.
 * No-ops if Redis is not configured.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!isRedisConfigured()) return;

  try {
    const redis = getRedis();
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logger.warn("Cache set error", "redis", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
  }
}

// ── Key Generators ───────────────────────────────────────────────

const PREFIX = "rag";

export function embeddingCacheKey(
  provider: string,
  query: string
): string {
  return `${PREFIX}:emb:${provider}:${hashQuery(query)}`;
}

export function classificationCacheKey(queryHash: string): string {
  return `${PREFIX}:cls:${queryHash}`;
}
