import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { initializeWeaviateSchema, initializeAllSchemas } from "@/lib/weaviate/schema";
import { EmbeddingProvider } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if a specific provider is requested
    let provider: EmbeddingProvider | "all" = "all";
    try {
      const body = await request.json();
      if (body.provider) {
        provider = body.provider;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    if (provider === "all") {
      await initializeAllSchemas();
      return NextResponse.json({
        success: true,
        message: "All Weaviate schemas initialized",
      });
    } else {
      await initializeWeaviateSchema(provider);
      return NextResponse.json({
        success: true,
        message: `Weaviate schema initialized for ${provider}`,
      });
    }
  } catch (error) {
    console.error("Schema initialization error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize schema" },
      { status: 500 }
    );
  }
}