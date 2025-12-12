import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processDocument } from "@/lib/processing/processor";
import { checkRequestRateLimit } from "@/lib/rateLimit/middleware";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  // Check rate limit for processing
  const rateLimit = await checkRequestRateLimit(request, "process");

  if (!rateLimit.success) {
    return rateLimit.errorResponse || new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const userId = rateLimit.userId!;
  try {
    // 1. Verify authentication
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;

    // 2. Verify document belongs to user
    const supabase = createServiceClient();
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("user_id, status")
      .eq("id", documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.user_id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 3. Check if already processed
    if (document.status === "processed") {
      return NextResponse.json(
        { error: "Document already processed" },
        { status: 400 }
      );
    }

    if (document.status === "processing") {
      return NextResponse.json(
        { error: "Document is currently being processed" },
        { status: 400 }
      );
    }

    // 4. Process the document
    const result = await processDocument(documentId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Processing failed" },
        { status: 500 }
      );
    }

    // 5. Return success with chunk info
    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunks.length,
      // Include first chunk as preview (for debugging)
      preview: result.chunks[0]?.content.substring(0, 200) + "...",
    });

  } catch (error) {
    console.error("Processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}