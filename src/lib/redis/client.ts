import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

/**
 * Get the Upstash Redis client singleton.
 * Only call this after checking isRedisConfigured().
 */
export function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Check if Redis credentials are available.
 * When false, the app falls back to in-memory implementations.
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
