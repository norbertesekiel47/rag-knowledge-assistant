import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deleteDocumentChunks } from "@/lib/weaviate/vectors";
import { EmbeddingProvider } from "@/lib/embeddings/config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE - Delete a document and its chunks
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: documentId } = await params;
    const supabase = createServiceClient();

    // 1. Fetch document to verify ownership and get details
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // 2. Delete chunks from Weaviate
    try {
      await deleteDocumentChunks(
        documentId,
        document.embedding_provider as EmbeddingProvider
      );
      console.log(`Deleted chunks for document ${documentId} from Weaviate`);
    } catch (weaviateError) {
      console.error("Error deleting chunks from Weaviate:", weaviateError);
      // Continue with deletion even if Weaviate fails
      // The chunks will be orphaned but won't affect functionality
    }

    // 3. Delete file from Supabase Storage
    try {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([document.storage_path]);

      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
      }
    } catch (storageError) {
      console.error("Error deleting file from storage:", storageError);
      // Continue with deletion even if storage fails
    }

    // 4. Delete document record from database
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting document record:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
      documentId,
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Fetch a single document
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: documentId } = await params;
    const supabase = createServiceClient();

    const { data: document, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Fetch document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}