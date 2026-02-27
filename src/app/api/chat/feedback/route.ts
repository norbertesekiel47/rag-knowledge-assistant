import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/chat/feedback?sessionId=xxx
 * Returns all feedback for a session (used to restore feedback state on page load).
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: feedback } = await supabase
      .from("message_feedback")
      .select("message_id, feedback")
      .eq("user_id", userId)
      .eq("session_id", sessionId);

    // Return as a map: { messageId: "positive"|"negative" }
    const feedbackMap: Record<string, string> = {};
    if (feedback) {
      for (const f of feedback) {
        feedbackMap[f.message_id] = f.feedback;
      }
    }

    return NextResponse.json({ feedbackMap });
  } catch (error) {
    logger.error("Feedback fetch error", "feedback", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, sessionId, feedback } = await request.json();

    if (!messageId || !sessionId || !["positive", "negative"].includes(feedback)) {
      return NextResponse.json(
        { error: "messageId, sessionId, and feedback (positive/negative) are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Check if feedback already exists for this message
    const { data: existing } = await supabase
      .from("message_feedback")
      .select("id, feedback")
      .eq("user_id", userId)
      .eq("message_id", messageId)
      .single();

    if (existing) {
      if (existing.feedback === feedback) {
        // Same feedback — toggle off (delete)
        await supabase
          .from("message_feedback")
          .delete()
          .eq("id", existing.id);

        // Remove chunk feedback associations
        await deleteChunkFeedback(supabase, messageId);

        return NextResponse.json({ feedback: null });
      } else {
        // Different feedback — update
        await supabase
          .from("message_feedback")
          .update({ feedback })
          .eq("id", existing.id);

        // Update chunk feedback signals
        await updateChunkFeedback(supabase, userId, messageId, feedback === "positive" ? 1 : -1);

        return NextResponse.json({ feedback });
      }
    }

    // No existing feedback — insert
    const { error } = await supabase.from("message_feedback").insert({
      user_id: userId,
      message_id: messageId,
      session_id: sessionId,
      feedback,
    });

    if (error) {
      logger.error("Failed to store feedback", "feedback", {
        error: { message: error.message },
      });
      return NextResponse.json({ error: "Failed to store feedback" }, { status: 500 });
    }

    // Store chunk-level feedback associations
    await storeChunkFeedback(supabase, userId, messageId, feedback === "positive" ? 1 : -1);

    return NextResponse.json({ feedback });
  } catch (error) {
    logger.error("Feedback error", "feedback", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Look up the sources from a chat message and store per-chunk feedback signals.
 */
async function storeChunkFeedback(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  messageId: string,
  signal: 1 | -1
) {
  try {
    const { data: message } = await supabase
      .from("chat_messages")
      .select("sources")
      .eq("id", messageId)
      .single();

    if (!message?.sources || !Array.isArray(message.sources)) return;

    const rows = message.sources
      .filter((source: { documentId?: string; chunkIndex?: number }) =>
        source.documentId && source.chunkIndex !== undefined
      )
      .map((source: { documentId: string; chunkIndex: number }) => ({
        user_id: userId,
        document_id: source.documentId,
        chunk_index: source.chunkIndex,
        feedback_signal: signal,
        message_id: messageId,
      }));

    if (rows.length > 0) {
      await supabase.from("chunk_feedback").insert(rows);
    }
  } catch (error) {
    logger.warn("Failed to store chunk feedback", "feedback", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
  }
}

/**
 * Delete all chunk feedback records for a message (used on toggle-off).
 */
async function deleteChunkFeedback(
  supabase: ReturnType<typeof createServiceClient>,
  messageId: string
) {
  try {
    await supabase.from("chunk_feedback").delete().eq("message_id", messageId);
  } catch (error) {
    logger.warn("Failed to delete chunk feedback", "feedback", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
  }
}

/**
 * Update chunk feedback when signal changes (delete old, re-insert with new signal).
 */
async function updateChunkFeedback(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  messageId: string,
  signal: 1 | -1
) {
  await deleteChunkFeedback(supabase, messageId);
  await storeChunkFeedback(supabase, userId, messageId, signal);
}
