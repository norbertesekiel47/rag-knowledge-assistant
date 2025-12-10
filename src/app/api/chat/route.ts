import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { searchChunks } from "@/lib/weaviate/vectors";
import {
  buildRAGPrompt,
  streamLLMResponse,
  LLMProvider,
  LLMMessage,
  RAGContext,
} from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  message: string;
  provider: LLMProvider;
  conversationHistory?: LLMMessage[];
}

const VALID_PROVIDERS: LLMProvider[] = ["llama-70b", "llama-8b", "qwen-32b"];

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userId } = await auth();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const body: ChatRequest = await request.json();
    const { message, provider, conversationHistory = [] } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return new Response(
        JSON.stringify({
          error: `Valid provider is required (${VALID_PROVIDERS.join(", ")})`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 3. Search for relevant context
    const searchResults = await searchChunks(message, userId, 5);

    // 4. Build RAG context
    const contexts: RAGContext[] = searchResults.map((result) => ({
      content: result.content,
      documentId: result.documentId,
      filename: result.filename,
      chunkIndex: result.chunkIndex,
      score: result.score,
    }));

    // 5. Build system prompt with context
    const systemPrompt = buildRAGPrompt(contexts);

    // 6. Prepare messages
    const messages: LLMMessage[] = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // 7. Create streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send sources first
        const sourcesData = JSON.stringify({
          type: "sources",
          sources: contexts.map((ctx) => ({
            documentId: ctx.documentId,
            filename: ctx.filename,
            chunkIndex: ctx.chunkIndex,
            score: ctx.score,
            preview: ctx.content.substring(0, 150) + "...",
          })),
        });
        controller.enqueue(encoder.encode(`data: ${sourcesData}\n\n`));

        // Stream LLM response
        await streamLLMResponse(
          provider,
          systemPrompt,
          messages,
          {
            onToken: (token) => {
              const tokenData = JSON.stringify({ type: "token", content: token });
              controller.enqueue(encoder.encode(`data: ${tokenData}\n\n`));
            },
            onComplete: (fullResponse) => {
              const completeData = JSON.stringify({
                type: "complete",
                content: fullResponse,
              });
              controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));
              controller.close();
            },
            onError: (error) => {
              const errorData = JSON.stringify({
                type: "error",
                error: error.message,
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
            },
          },
          0.7,
          2048
        );
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}