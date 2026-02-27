import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { initializeAllSchemas, initializeAllSchemasV2, checkCollectionExists } from "@/lib/weaviate/schema";
import { logger } from "@/lib/utils/logger";

// GET - Check if Weaviate is initialized
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if both V1 and V2 collections exist
    const voyageExists = await checkCollectionExists("DocumentChunkVoyage");
    const huggingfaceExists = await checkCollectionExists("DocumentChunkHuggingFace");
    const voyageV2Exists = await checkCollectionExists("DocumentChunkVoyageV2");
    const huggingfaceV2Exists = await checkCollectionExists("DocumentChunkHuggingFaceV2");

    return NextResponse.json({
      initialized: voyageExists && huggingfaceExists,
      v2Initialized: voyageV2Exists && huggingfaceV2Exists,
      collections: {
        voyage: voyageExists,
        huggingface: huggingfaceExists,
        voyageV2: voyageV2Exists,
        huggingfaceV2: huggingfaceV2Exists,
      },
    });
  } catch (error) {
    logger.error("Weaviate status check error", "weaviate-setup", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
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
    await initializeAllSchemasV2();

    return NextResponse.json({
      success: true,
      message: "Weaviate V1 and V2 schemas initialized successfully",
    });
  } catch (error) {
    logger.error("Weaviate setup error", "weaviate-setup", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to initialize Weaviate schema" },
      { status: 500 }
    );
  }
}
