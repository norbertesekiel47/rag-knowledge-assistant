import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateChatTitle } from "@/lib/llm/titleGenerator";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const title = await generateChatTitle(message);

    return NextResponse.json({ title });
  } catch (error) {
    logger.error("Title generation error", "generate-title", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 }
    );
  }
}
