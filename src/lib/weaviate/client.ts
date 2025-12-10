import weaviate, { WeaviateClient } from "weaviate-client";

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

  client = await weaviate.connectToWeaviateCloud(weaviateUrl, {
    authCredentials: new weaviate.ApiKey(weaviateApiKey),
  });

  return client;
}

// Close connection when needed (e.g., in tests)
export async function closeWeaviateClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}