import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { searchChunks } from "@/lib/weaviate/vectors";
import { checkRequestRateLimit } from "@/lib/rateLimit/middleware";
import { getRateLimitHeaders } from "@/lib/rateLimit";
import {
  buildRAGPrompt,
  streamLLMResponse,
  LLMProvider,
  LLMMessage,
  RAGContext,
} from "@/lib/llm";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings";
import { trackQuery } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  message: string;
  provider: LLMProvider;
  conversationHistory?: LLMMessage[];
  embeddingProvider?: EmbeddingProvider;
}

const VALID_PROVIDERS: LLMProvider[] = ["llama-70b", "llama-8b", "qwen-32b"];

export async function POST(request: NextRequest): Promise<Response> {
  // Check rate limit
  const rateLimit = await checkRequestRateLimit(request, "chat");

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

    /*if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }*/

    const startTime = Date.now();

    const body: ChatRequest = await request.json();
    const {
      message,
      provider,
      conversationHistory = [],
      embeddingProvider = DEFAULT_EMBEDDING_PROVIDER,
    } = body;

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

    // Search for relevant context using selected embedding provider
    const searchResults = await searchChunks(message, userId, embeddingProvider, 5);

    const contexts: RAGContext[] = searchResults.map((result) => ({
      content: result.content,
      documentId: result.documentId,
      filename: result.filename,
      chunkIndex: result.chunkIndex,
      score: result.score,
    }));

    const systemPrompt = buildRAGPrompt(contexts);

    const messages: LLMMessage[] = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
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
              
              // Track analytics (don't await - fire and forget)
              trackQuery({
                userId,
                queryText: message,
                model: provider,
                embeddingProvider,
                responseTimeMs: Date.now() - startTime,
                sources: contexts.map((ctx) => ({
                  documentId: ctx.documentId,
                  chunkIndex: ctx.chunkIndex,
                  relevanceScore: ctx.score,
                })),
              }).catch(console.error);
              
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
        ...(rateLimit.result ? getRateLimitHeaders(rateLimit.result) : {}),
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