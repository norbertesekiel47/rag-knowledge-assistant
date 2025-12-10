import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { searchChunks } from "@/lib/weaviate/vectors";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query, limit = 5, embeddingProvider = DEFAULT_EMBEDDING_PROVIDER } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (query.trim().length === 0) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }

    const results = await searchChunks(
      query,
      userId,
      embeddingProvider as EmbeddingProvider,
      Math.min(limit, 20)
    );

    return NextResponse.json({
      query,
      results,
      count: results.length,
      embeddingProvider,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}