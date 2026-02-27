import { logger } from "@/lib/utils/logger";

/**
 * Validate all required environment variables at startup.
 * Called from src/instrumentation.ts during server initialization.
 */
export function validateEnv(): void {
  const required: { name: string; description: string }[] = [
    { name: "GROQ_API_KEY", description: "Groq LLM API key" },
    { name: "NEXT_PUBLIC_SUPABASE_URL", description: "Supabase project URL" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Supabase service role key" },
    { name: "WEAVIATE_URL", description: "Weaviate cloud instance URL" },
    { name: "WEAVIATE_API_KEY", description: "Weaviate API key" },
  ];

  const optional: { name: string; description: string }[] = [
    { name: "VOYAGE_API_KEY", description: "Voyage AI embeddings (required if using Voyage provider)" },
    { name: "HUGGINGFACE_API_KEY", description: "HuggingFace embeddings (required if using HuggingFace provider)" },
    { name: "UPSTASH_REDIS_REST_URL", description: "Upstash Redis URL (rate limiting persistence)" },
    { name: "UPSTASH_REDIS_REST_TOKEN", description: "Upstash Redis token (rate limiting persistence)" },
  ];

  const missing: string[] = [];

  for (const { name, description } of required) {
    if (!process.env[name]) {
      missing.push(`  - ${name}: ${description}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join("\n")}\n\n` +
      `Add them to .env.local or your deployment environment.`
    );
  }

  // Warn about optional vars
  const warnings: string[] = [];
  for (const { name, description } of optional) {
    if (!process.env[name]) {
      warnings.push(`  - ${name}: ${description}`);
    }
  }

  if (warnings.length > 0) {
    logger.warn(
      `Optional environment variables not configured:\n${warnings.join("\n")}`,
      "env"
    );
  }

  logger.info("All required environment variables validated", "env");
}
