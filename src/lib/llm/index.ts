import { streamGroqResponse, callGroqNonStreaming } from "./groq";
import { LLMProvider, LLMMessage, StreamCallbacks, RAGContext, MODEL_IDS } from "./types";
import { wrapDocumentContext, INSTRUCTION_ANCHOR } from "@/lib/security/promptDefense";

export * from "./types";

export interface RAGContextV2 extends RAGContext {
  sectionTitle: string;
  summary: string;
  chunkType: string;
}

/**
 * Build the RAG system prompt with context (V1)
 */
export function buildRAGPrompt(contexts: RAGContext[]): string {
  const contextText = contexts
    .map(
      (ctx, i) =>
        `[Source ${i + 1}: ${ctx.filename} (relevance: ${(ctx.score * 100).toFixed(0)}%)]\n${wrapDocumentContext(ctx.content, ctx.filename)}`
    )
    .join("\n\n---\n\n");

  return `You are a helpful AI assistant with access to the user's personal knowledge base. Answer questions based on the provided context from their documents.

INSTRUCTIONS:
1. Base your answers primarily on the provided context
2. If the context doesn't contain enough information to fully answer, say so clearly
3. When referencing information, cite using numbered references like [1], [2] matching the source numbers above. Do NOT write filenames or section titles inline — just use the bracketed number
4. Be concise but thorough
5. If asked about something not in the context, you can use your general knowledge but clearly indicate this

CONTEXT FROM USER'S DOCUMENTS:
${contextText}

---

Remember: Prioritize information from the user's documents. Cite sources using [1], [2] format only.${INSTRUCTION_ANCHOR}`;
}

/**
 * Build the RAG system prompt with enriched V2 context.
 * Includes section titles and summaries for better LLM understanding.
 */
export function buildRAGPromptV2(contexts: RAGContextV2[]): string {
  const contextText = contexts
    .map((ctx, i) => {
      const sectionInfo = ctx.sectionTitle ? ` > ${ctx.sectionTitle}` : "";
      const summaryLine = ctx.summary ? `\nSummary: ${ctx.summary}` : "";
      return `[Source ${i + 1}: ${ctx.filename}${sectionInfo} (relevance: ${(ctx.score * 100).toFixed(0)}%, type: ${ctx.chunkType})]${summaryLine}\n${wrapDocumentContext(ctx.content, ctx.filename)}`;
    })
    .join("\n\n---\n\n");

  return `You are a helpful AI assistant with access to the user's personal knowledge base. Answer questions based on the provided context from their documents.

INSTRUCTIONS:
1. Base your answers primarily on the provided context
2. If the context doesn't contain enough information to fully answer, say so clearly
3. When referencing information, cite using numbered references like [1], [2] matching the source numbers above. Do NOT write filenames or section titles inline — just use the bracketed number
4. Use the provided summaries to quickly understand each chunk's content
5. Be concise but thorough
6. If asked about something not in the context, you can use your general knowledge but clearly indicate this

CONTEXT FROM USER'S DOCUMENTS:
${contextText}

---

Remember: Prioritize information from the user's documents. Cite sources using [1], [2] format only.${INSTRUCTION_ANCHOR}`;
}

/**
 * Non-streaming LLM call for internal reasoning (classifier, decomposer, tools).
 * Uses llama-3.1-8b-instant by default for speed.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const model = options?.model || MODEL_IDS["llama-8b"];
  const temperature = options?.temperature ?? 0;
  const maxTokens = options?.maxTokens ?? 512;

  return callGroqNonStreaming(model, systemPrompt, userPrompt, temperature, maxTokens);
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