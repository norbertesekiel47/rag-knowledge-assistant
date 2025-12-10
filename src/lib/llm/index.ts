import { streamGroqResponse } from "./groq";
import { LLMProvider, LLMMessage, StreamCallbacks, RAGContext } from "./types";

export * from "./types";

/**
 * Build the RAG system prompt with context
 */
export function buildRAGPrompt(contexts: RAGContext[]): string {
  const contextText = contexts
    .map(
      (ctx, i) =>
        `[Source ${i + 1}: ${ctx.filename} (relevance: ${(ctx.score * 100).toFixed(0)}%)]\n${ctx.content}`
    )
    .join("\n\n---\n\n");

  return `You are a helpful AI assistant with access to the user's personal knowledge base. Answer questions based on the provided context from their documents.

INSTRUCTIONS:
1. Base your answers primarily on the provided context
2. If the context doesn't contain enough information to fully answer, say so clearly
3. When referencing information, mention which source document it came from
4. Be concise but thorough
5. If asked about something not in the context, you can use your general knowledge but clearly indicate this

CONTEXT FROM USER'S DOCUMENTS:
${contextText}

---

Remember: Prioritize information from the user's documents. Always cite which document you're referencing.`;
}

/**
 * Stream a response from the selected LLM provider
 */
export async function streamLLMResponse(
  provider: LLMProvider,
  systemPrompt: string,
  messages: LLMMessage[],
  callbacks: StreamCallbacks,
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<void> {
  return streamGroqResponse(
    provider,
    systemPrompt,
    messages,
    callbacks,
    temperature,
    maxTokens
  );
}