import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_DISPLAY,
  isAllowedMimeType,
  getFileType,
  ALLOWED_EXTENSIONS,
} from "@/lib/constants";
import { processDocument } from "@/lib/processing/processor";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse the form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 3. Server-side validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_DISPLAY} limit` },
        { status: 400 }
      );
    }

    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const fileType = getFileType(file.type);
    if (!fileType) {
      return NextResponse.json(
        { error: "Could not determine file type" },
        { status: 400 }
      );
    }

    // 4. Prepare file for upload
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${userId}/${timestamp}_${sanitizedFilename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Upload to Supabase Storage
    const supabase = createServiceClient();

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // 6. Create document record in database
    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        filename: file.name,
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        status: "pending",
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

    // 7. Trigger processing (non-blocking)
    // We don't await this - it runs in the background
    processDocument(document.id)
      .then((result) => {
        if (result.success) {
          console.log(`Background processing complete: ${result.chunks.length} chunks`);
        } else {
          console.error(`Background processing failed: ${result.error}`);
        }
      })
      .catch((error) => {
        console.error("Background processing error:", error);
      });

    // 8. Return the document immediately (processing happens in background)
    return NextResponse.json({ document }, { status: 201 });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch user's documents
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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