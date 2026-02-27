import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the logger so it doesn't try to import real modules
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { validateEnv } from "./env";

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env to a clean slate
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const requiredVars = {
    GROQ_API_KEY: "gsk_test",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "eyJ_test",
    WEAVIATE_URL: "https://test.weaviate.network",
    WEAVIATE_API_KEY: "test_key",
  };

  it("throws when required vars are missing", () => {
    // Clear all required vars
    for (const key of Object.keys(requiredVars)) {
      delete process.env[key];
    }

    expect(() => validateEnv()).toThrow("Missing required environment variables");
  });

  it("succeeds when all required vars are set", () => {
    Object.assign(process.env, requiredVars);
    expect(() => validateEnv()).not.toThrow();
  });

  it("error message lists missing var names", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.WEAVIATE_URL;
    // Set the others
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJ_test";
    process.env.WEAVIATE_API_KEY = "test_key";

    try {
      validateEnv();
      expect.fail("Should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("GROQ_API_KEY");
      expect(message).toContain("WEAVIATE_URL");
    }
  });

  it("does not throw for missing optional vars", () => {
    Object.assign(process.env, requiredVars);
    delete process.env.VOYAGE_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;

    expect(() => validateEnv()).not.toThrow();
  });
});
