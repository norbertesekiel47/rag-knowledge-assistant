export interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed
  windowMs: number;     // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;  // Timestamp when the limit resets
}

// In-memory store for rate limiting
// Note: This resets on server restart. Use Redis for production.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const record = rateLimitStore.get(key);

  // If no record exists or window has expired, create new record
  if (!record || now > record.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(key, record);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - record.count,
    reset: record.resetTime,
  };
}

/**
 * Create a rate limiter for a specific endpoint
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (identifier: string): RateLimitResult => {
    return checkRateLimit(identifier, config);
  };
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  chat: createRateLimiter({ maxRequests: 20, windowMs: 60 * 1000 }),
  search: createRateLimiter({ maxRequests: 30, windowMs: 60 * 1000 }),
  upload: createRateLimiter({ maxRequests: 10, windowMs: 60 * 1000 }),
  process: createRateLimiter({ maxRequests: 5, windowMs: 60 * 1000 }),
  general: createRateLimiter({ maxRequests: 100, windowMs: 60 * 1000 }),
};

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
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