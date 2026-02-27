import { NextRequest } from "next/server";
import { checkRequestRateLimit } from "@/lib/rateLimit/middleware";
import { getRateLimitHeaders } from "@/lib/rateLimit";
import {
  streamLLMResponse,
  LLMProvider,
  LLMMessage,
} from "@/lib/llm";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings";
import { trackQuery } from "@/lib/analytics";
import { orchestrate } from "@/lib/reasoning/orchestrator";
import { evaluateResponse } from "@/lib/validation/evaluator";
import { storeEvaluation } from "@/lib/validation/store";
import {
  sanitizeForPrompt,
  sanitizeConversationHistory,
  validateMessageLength,
} from "@/lib/security/sanitize";
import { logger } from "@/lib/utils/logger";
import type { SearchFilters } from "@/lib/processing/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  message: string;
  provider: LLMProvider;
  conversationHistory?: LLMMessage[];
  embeddingProvider?: EmbeddingProvider;
  filters?: SearchFilters;
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
    const startTime = Date.now();

    const body: ChatRequest = await request.json();
    const {
      message,
      provider,
      conversationHistory = [],
      embeddingProvider = DEFAULT_EMBEDDING_PROVIDER,
      filters,
    } = body;

    // Validate message length and content
    const messageError = validateMessageLength(message);
    if (messageError) {
      return new Response(JSON.stringify({ error: messageError }), {
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

    // Sanitize inputs before downstream use
    const sanitizedMessage = sanitizeForPrompt(message);
    const cleanHistory = sanitizeConversationHistory(conversationHistory);

    // Orchestrate: classify → route → retrieve → build prompt
    // Wrapped in try/catch so errors become SSE error events, not JSON 500s
    let orchestration;
    try {
      orchestration = await orchestrate({
        query: sanitizedMessage,
        userId,
        provider,
        embeddingProvider,
        conversationHistory: cleanHistory,
        filters,
      });
    } catch (orchError) {
      logger.error("Orchestration failed", "chat", {
        error: orchError instanceof Error ? { message: orchError.message } : { error: String(orchError) },
      });
      // Return the error as an SSE stream so the client handles it correctly
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          const errorData = JSON.stringify({
            type: "error",
            error: orchError instanceof Error ? orchError.message : "Failed to process query",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        },
      });
      return new Response(errorStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...(rateLimit.result ? getRateLimitHeaders(rateLimit.result) : {}),
        },
      });
    }

    const { contexts, systemPrompt, metadata } = orchestration;

    const messages: LLMMessage[] = [
      ...cleanHistory,
      { role: "user", content: sanitizedMessage },
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send reasoning metadata
        const reasoningData = JSON.stringify({
          type: "reasoning",
          category: metadata.queryCategory,
          subQueries: metadata.subQueries,
          toolsUsed: metadata.toolsUsed,
          reasoningTimeMs: metadata.reasoningTimeMs,
        });
        controller.enqueue(encoder.encode(`data: ${reasoningData}\n\n`));

        // Send sources (may be empty for conversational queries)
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

              // Track analytics (fire and forget)
              trackQuery({
                userId,
                queryText: sanitizedMessage,
                model: provider,
                embeddingProvider,
                responseTimeMs: Date.now() - startTime,
                sources: contexts.map((ctx) => ({
                  documentId: ctx.documentId,
                  chunkIndex: ctx.chunkIndex,
                  relevanceScore: ctx.score,
                })),
              }).catch((err) =>
                logger.warn("Analytics tracking failed", "chat", {
                  error: err instanceof Error ? { message: err.message } : { error: String(err) },
                })
              );

              // Fire-and-forget validation (skip for conversational)
              if (metadata.queryCategory !== "conversational") {
                evaluateResponse({
                  query: message,
                  response: fullResponse,
                  contexts,
                  queryCategory: metadata.queryCategory,
                }).then((evaluation) =>
                  storeEvaluation({
                    userId,
                    queryText: sanitizedMessage,
                    responseText: fullResponse,
                    model: provider,
                    queryCategory: metadata.queryCategory,
                    evaluation,
                  })
                ).catch((err) =>
                  logger.warn("Evaluation failed", "chat", {
                    error: err instanceof Error ? { message: err.message } : { error: String(err) },
                  })
                );
              }

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
    logger.error("Chat error", "chat", {
      error: error instanceof Error ? { message: error.message } : { error: String(error) },
    });
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
