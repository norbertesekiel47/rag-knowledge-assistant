/**
 * Prompt templates for the reasoning engine.
 * Centralized here for easy tuning and consistency.
 */

import { sanitizeForPrompt } from "@/lib/security/sanitize";
import { wrapUserInput, wrapDocumentContext, INSTRUCTION_ANCHOR } from "@/lib/security/promptDefense";

// ── Query Classifier ──────────────────────────────────────────────

export const CLASSIFIER_SYSTEM_PROMPT = `You are a query classifier for a RAG (Retrieval-Augmented Generation) system. Your job is to categorize user queries into exactly one of three categories.

Categories:
1. "simple" — A direct factual question that can be answered with a single document retrieval. Examples: "What is X?", "How does Y work?", "What are the requirements for Z?"
2. "complex" — A query requiring multiple retrievals, comparison, synthesis, or multi-part answers. Examples: "Compare A and B", "Summarize everything about topic Z", "What are the relationships between X, Y, and Z?", "List all policies and how they interact"
3. "conversational" — No document retrieval needed. Greetings, thanks, requests to rephrase, clarifications about previous responses, or meta-questions about the assistant itself. Examples: "Thanks!", "Can you rephrase that?", "Hello", "What did you mean by that?"

Rules:
- If the user references "that" or "it" referring to a previous assistant response and is asking for clarification or rephrasing, classify as "conversational"
- If the user references "that" but asks a NEW question about it requiring document lookup, classify as "simple" or "complex"
- When in doubt between simple and complex, prefer "simple"
- Always respond with valid JSON only

Respond with a JSON object:
{"category": "simple"|"complex"|"conversational", "reasoning": "brief explanation", "suggestedApproach": "hint for retrieval strategy"}${INSTRUCTION_ANCHOR}`;

export function buildClassifierUserPrompt(
  query: string,
  conversationHistory: { role: string; content: string }[]
): string {
  const recentHistory = conversationHistory.slice(-6);
  const historyText =
    recentHistory.length > 0
      ? `\nRecent conversation:\n${recentHistory.map((m) => `${m.role}: ${m.content.substring(0, 200)}`).join("\n")}\n`
      : "";

  const sanitizedQuery = sanitizeForPrompt(query);

  return `${historyText}Current user query:
${wrapUserInput(sanitizedQuery)}

Classify this query.`;
}

// ── Query Decomposer ──────────────────────────────────────────────

export const DECOMPOSER_SYSTEM_PROMPT = `You are a query decomposition assistant for a RAG system. Given a complex user query, break it into 2-4 focused sub-queries that can each be answered with a single document retrieval.

Rules:
- Each sub-query should be a clear, self-contained search query
- Sub-queries should collectively cover all aspects of the original query
- Decide if sub-queries can run in parallel (independent) or must run sequentially (later ones depend on earlier results)
- Provide a synthesis instruction explaining how to combine results into a final answer
- Generate at most 4 sub-queries
- Always respond with valid JSON only

Respond with a JSON object:
{"subQueries": ["query1", "query2", ...], "strategy": "parallel"|"sequential", "synthesisInstruction": "how to combine results"}${INSTRUCTION_ANCHOR}`;

export function buildDecomposerUserPrompt(query: string): string {
  const sanitizedQuery = sanitizeForPrompt(query);

  return `Complex query:
${wrapUserInput(sanitizedQuery)}

Decompose this into focused sub-queries.`;
}

// ── Summarization Tool ────────────────────────────────────────────

export const SUMMARIZER_SYSTEM_PROMPT = `You are a summarization assistant. Given document chunks and a focus topic, produce a concise summary that captures the key information relevant to the focus topic. Be factual and cite which documents the information comes from.`;

export function buildSummarizerUserPrompt(
  chunks: { content: string; filename: string }[],
  focus: string
): string {
  const chunksText = chunks
    .map((c, i) => `[${i + 1}: ${c.filename}] ${c.content.substring(0, 500)}`)
    .join("\n\n");

  return `Focus: ${focus}

Document chunks:
${chunksText}

Provide a focused summary.`;
}

// ── Comparison Tool ───────────────────────────────────────────────

export const COMPARATOR_SYSTEM_PROMPT = `You are a comparison assistant. Given two groups of document chunks, produce a structured comparison highlighting similarities, differences, and key insights. Be factual and reference the source documents.`;

export function buildComparatorUserPrompt(
  groupA: { label: string; chunks: { content: string; filename: string }[] },
  groupB: { label: string; chunks: { content: string; filename: string }[] },
  criteria: string
): string {
  const groupAText = groupA.chunks
    .map((c, i) => `[${i + 1}: ${c.filename}] ${c.content.substring(0, 400)}`)
    .join("\n");
  const groupBText = groupB.chunks
    .map((c, i) => `[${i + 1}: ${c.filename}] ${c.content.substring(0, 400)}`)
    .join("\n");

  return `Comparison criteria: ${criteria}

Group A - ${groupA.label}:
${groupAText}

Group B - ${groupB.label}:
${groupBText}

Compare these groups.`;
}

// ── System Prompts for Orchestrated Responses ─────────────────────

export const CONVERSATIONAL_SYSTEM_PROMPT = `You are a helpful AI assistant. The user's message does not require document retrieval — respond based on the conversation context. Be friendly and concise. If the user asks a question that would benefit from their documents, let them know you can search their knowledge base if they rephrase as a specific question.`;

export function buildComplexRAGPrompt(
  contexts: {
    content: string;
    filename: string;
    sectionTitle: string;
    summary: string;
    chunkType: string;
    score: number;
    subQuery?: string;
  }[],
  synthesisInstruction: string
): string {
  const contextText = contexts
    .map((ctx, i) => {
      const sectionInfo = ctx.sectionTitle ? ` > ${ctx.sectionTitle}` : "";
      const summaryLine = ctx.summary ? `\nSummary: ${ctx.summary}` : "";
      const subQueryLine = ctx.subQuery
        ? `\nRetrieved for: "${ctx.subQuery}"`
        : "";
      return `[Source ${i + 1}: ${ctx.filename}${sectionInfo} (relevance: ${(ctx.score * 100).toFixed(0)}%, type: ${ctx.chunkType})]${subQueryLine}${summaryLine}\n${wrapDocumentContext(ctx.content, ctx.filename)}`;
    })
    .join("\n\n---\n\n");

  return `You are a helpful AI assistant with access to the user's personal knowledge base. This is a complex query requiring synthesis of multiple pieces of information.

SYNTHESIS INSTRUCTION: ${sanitizeForPrompt(synthesisInstruction, 500)}

INSTRUCTIONS:
1. Follow the synthesis instruction above to structure your response
2. Base your answers on the provided context from the user's documents
3. When referencing information, cite using numbered references like [1], [2] matching the source numbers above. Do NOT write filenames or section titles inline — just use the bracketed number
4. If some aspects of the query cannot be fully answered from the context, say so clearly
5. Be thorough but organized — use headings or bullet points for multi-part answers

CONTEXT FROM USER'S DOCUMENTS:
${contextText}

---

Remember: Follow the synthesis instruction. Cite sources using [1], [2] format only. Be thorough.${INSTRUCTION_ANCHOR}`;
}
