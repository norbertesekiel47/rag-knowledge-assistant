import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { initializeWeaviateSchema } from "@/lib/weaviate/schema";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await initializeWeaviateSchema();

    return NextResponse.json({
      success: true,
      message: "Weaviate schema initialized",
    });
  } catch (error) {
    console.error("Schema initialization error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize schema" },
      { status: 500 }
    );
  }
}