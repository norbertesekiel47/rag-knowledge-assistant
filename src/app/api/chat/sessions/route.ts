import { NextRequest, NextResponse } from "next/server";
import { checkRequestRateLimit } from "@/lib/rateLimit/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

// GET - Fetch chat sessions for the user (paginated)
export async function GET(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, "general");

    if (!rateLimit.success) {
      return rateLimit.errorResponse || NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const userId = rateLimit.userId!;

    // Pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const supabase = createServiceClient();

    const { data: sessions, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error("Error fetching sessions", "sessions", {
        error: { message: error.message },
      });
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error("Sessions fetch error", "sessions", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, "general");

    if (!rateLimit.success) {
      return rateLimit.errorResponse || NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const userId = rateLimit.userId!;

    const body = await request.json();
    const { title = "New Chat" } = body;

    const supabase = createServiceClient();

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: userId,
        title: title.slice(0, 100), // Limit title length
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating session", "sessions", {
        error: { message: error.message },
      });
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    logger.error("Session creation error", "sessions", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
