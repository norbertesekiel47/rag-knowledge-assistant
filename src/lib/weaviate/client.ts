import weaviate, { WeaviateClient } from "weaviate-client";
import { withTimeout } from "@/lib/utils/retry";
import { logger } from "@/lib/utils/logger";

let client: WeaviateClient | null = null;

export async function getWeaviateClient(): Promise<WeaviateClient> {
  if (client) {
    return client;
  }

  const weaviateUrl = process.env.WEAVIATE_URL;
  const weaviateApiKey = process.env.WEAVIATE_API_KEY;

  if (!weaviateUrl || !weaviateApiKey) {
    throw new Error("Missing Weaviate environment variables");
  }

  try {
    client = await withTimeout(
      () =>
        weaviate.connectToWeaviateCloud(weaviateUrl, {
          authCredentials: new weaviate.ApiKey(weaviateApiKey),
        }),
      { timeoutMs: 15000 },
      "weaviate-connect"
    );
  } catch (error) {
    logger.error("Weaviate connection failed", "weaviate", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    throw error;
  }

  return client;
}

/**
 * Reset the singleton — forces reconnect on next call.
 * Used when the connection becomes stale.
 */
export async function resetWeaviateClient(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close errors on stale connections
    }
    client = null;
  }
}

// Close connection when needed (e.g., in tests)
export async function closeWeaviateClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
