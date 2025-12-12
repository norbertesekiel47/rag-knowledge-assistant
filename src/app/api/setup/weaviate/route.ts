import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { initializeAllSchemas, checkCollectionExists } from "@/lib/weaviate/schema";

// GET - Check if Weaviate is initialized
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if both collections exist
    const voyageExists = await checkCollectionExists("DocumentChunkVoyage");
    const huggingfaceExists = await checkCollectionExists("DocumentChunkHuggingFace");

    return NextResponse.json({
      initialized: voyageExists && huggingfaceExists,
      collections: {
        voyage: voyageExists,
        huggingface: huggingfaceExists,
      },
    });
  } catch (error) {
    console.error("Weaviate status check error:", error);
    return NextResponse.json(
      { error: "Failed to check Weaviate status" },
      { status: 500 }
    );
  }
}

// POST - Initialize Weaviate schema
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initializeAllSchemas();

    return NextResponse.json({
      success: true,
      message: "Weaviate schema initialized successfully",
    });
  } catch (error) {
    console.error("Weaviate setup error:", error);
    return NextResponse.json(
      { error: "Failed to initialize Weaviate schema" },
      { status: 500 }
    );
  }
}