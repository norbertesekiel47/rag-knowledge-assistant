import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_DISPLAY,
  ALLOWED_EXTENSIONS,
  isAllowedFile,
  getFileType,
} from "@/lib/constants";
import { processDocument } from "@/lib/processing/processor";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings";
import { checkRequestRateLimit } from "@/lib/rateLimit/middleware";

const FILE_TYPE_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};

export async function POST(request: NextRequest): Promise<Response> {
  const rateLimit = await checkRequestRateLimit(request, "upload");

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

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const embeddingProvider = (formData.get("embeddingProvider") as EmbeddingProvider) || DEFAULT_EMBEDDING_PROVIDER;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check for duplicate file (same filename + same embedding provider)
    const supabaseCheck = createServiceClient();
    const { data: existingDoc } = await supabaseCheck
      .from("documents")
      .select("id, status, filename")
      .eq("user_id", userId)
      .eq("filename", file.name)
      .eq("embedding_provider", embeddingProvider)
      .single();

    if (existingDoc) {
      const statusMessage = existingDoc.status === "processed" 
        ? "already processed" 
        : existingDoc.status === "processing"
        ? "currently being processed"
        : existingDoc.status === "failed"
        ? "previously failed (delete it first to retry)"
        : "already uploaded";
        
      return NextResponse.json(
        { 
          error: `File "${file.name}" is ${statusMessage} with ${embeddingProvider === "voyage" ? "Voyage AI" : "HuggingFace"}.`,
          duplicate: true,
          existingDocument: existingDoc
        },
        { status: 409 } // 409 Conflict
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_DISPLAY} limit` },
        { status: 400 }
      );
    }

    if (!isAllowedFile(file.type, file.name)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const fileType = getFileType(file.type, file.name);
    if (!fileType) {
      return NextResponse.json(
        { error: "Could not determine file type" },
        { status: 400 }
      );
    }

    const mimeType = FILE_TYPE_TO_MIME[fileType] || "application/octet-stream";
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${userId}/${timestamp}_${sanitizedFilename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createServiceClient();

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    const { data: document, error: dbError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      filename: file.name,
      file_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      status: "pending",
      embedding_provider: embeddingProvider,
    })
    .select()
    .single();

    if (dbError) {
      await supabase.storage.from("documents").remove([storagePath]);
      console.error("Database insert error:", dbError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Trigger processing with selected embedding provider
    processDocument(document.id, embeddingProvider)
      .then((result) => {
        if (result.success) {
          console.log(`Background processing complete: ${result.chunks.length} chunks (${embeddingProvider})`);
        } else {
          console.error(`Background processing failed: ${result.error}`);
        }
      })
      .catch((error) => {
        console.error("Background processing error:", error);
      });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  // Check rate limit
  const rateLimit = await checkRequestRateLimit(request, "general");

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
    //const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}