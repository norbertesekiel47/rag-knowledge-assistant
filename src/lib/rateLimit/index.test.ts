import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis as not configured so we test the in-memory path
vi.mock("@/lib/redis/client", () => ({
  isRedisConfigured: () => false,
  getRedis: () => { throw new Error("Redis not configured"); },
}));

import {
  checkRateLimit,
  getRateLimitHeaders,
  rateLimitExceededResponse,
  rateLimitConfigs,
} from "./index";

describe("checkRateLimit (in-memory)", () => {
  // Use unique identifiers per test to avoid cross-test pollution
  let testId = 0;
  beforeEach(() => { testId++; });

  it("allows first request", async () => {
    const result = await checkRateLimit(`user-${testId}`, { maxRequests: 5, windowMs: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("decrements remaining on each request", async () => {
    const id = `user-decrement-${testId}`;
    const config = { maxRequests: 3, windowMs: 60000 };

    const r1 = await checkRateLimit(id, config);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(id, config);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(id, config);
    expect(r3.remaining).toBe(0);
  });

  it("blocks after limit is exceeded", async () => {
    const id = `user-block-${testId}`;
    const config = { maxRequests: 2, windowMs: 60000 };

    await checkRateLimit(id, config);
    await checkRateLimit(id, config);
    const result = await checkRateLimit(id, config);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("uses independent limits per identifier", async () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    const r1 = await checkRateLimit(`userA-${testId}`, config);
    const r2 = await checkRateLimit(`userB-${testId}`, config);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("includes reset timestamp", async () => {
    const before = Date.now();
    const result = await checkRateLimit(`user-reset-${testId}`, { maxRequests: 5, windowMs: 60000 });
    expect(result.reset).toBeGreaterThanOrEqual(before);
    expect(result.reset).toBeLessThanOrEqual(before + 61000);
  });
});

describe("getRateLimitHeaders", () => {
  it("returns correct header format", () => {
    const headers = getRateLimitHeaders({
      success: true,
      limit: 20,
      remaining: 15,
      reset: 1700000000000,
    });

    expect(headers["X-RateLimit-Limit"]).toBe("20");
    expect(headers["X-RateLimit-Remaining"]).toBe("15");
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000000");
  });
});

describe("rateLimitExceededResponse", () => {
  it("returns 429 status", () => {
    const response = rateLimitExceededResponse({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 30000,
    });

    expect(response.status).toBe(429);
  });

  it("includes Retry-After header", () => {
    const response = rateLimitExceededResponse({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 30000,
    });

    const retryAfter = response.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("includes rate limit headers", () => {
    const response = rateLimitExceededResponse({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 30000,
    });

    expect(response.headers.get("X-RateLimit-Limit")).toBe("20");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("rateLimitConfigs", () => {
  it("has correct chat limits", () => {
    expect(rateLimitConfigs.chat.maxRequests).toBe(20);
    expect(rateLimitConfigs.chat.windowMs).toBe(60000);
  });

  it("has correct search limits", () => {
    expect(rateLimitConfigs.search.maxRequests).toBe(30);
  });

  it("has correct upload limits", () => {
    expect(rateLimitConfigs.upload.maxRequests).toBe(10);
  });

  it("has correct process limits", () => {
    expect(rateLimitConfigs.process.maxRequests).toBe(5);
  });

  it("has correct general limits", () => {
    expect(rateLimitConfigs.general.maxRequests).toBe(100);
  });
});
