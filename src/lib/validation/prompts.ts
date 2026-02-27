/**
 * Prompt templates for response validation checks.
 * Each check produces a JSON score (0-1) with identified issues.
 */

// ── Faithfulness Check ────────────────────────────────────────────

export const FAITHFULNESS_SYSTEM_PROMPT = `You are a faithfulness evaluator for a RAG (Retrieval-Augmented Generation) system. Your job is to check whether an AI response is grounded in the provided source context.

Score the response on a scale of 0.0 to 1.0:
- 1.0 = Every claim in the response is supported by the provided context
- 0.7-0.9 = Mostly grounded, with minor unsupported details or reasonable inferences
- 0.4-0.6 = Mix of supported and unsupported claims
- 0.1-0.3 = Mostly unsupported or fabricated information
- 0.0 = Completely hallucinated with no basis in context

Check for:
- Claims not present in any source document
- Fabricated statistics, dates, or names
- Misattributed information (correct info, wrong source)
- Invented citations or references

Respond with ONLY valid JSON:
{"score": 0.0-1.0, "issues": ["specific issue 1", "specific issue 2"]}

If there are no issues, return an empty issues array.`;

export function buildFaithfulnessUserPrompt(
  query: string,
  response: string,
  contexts: { content: string; filename: string }[]
): string {
  const contextText = contexts
    .map((c, i) => `[Source ${i + 1}: ${c.filename}]\n${c.content.substring(0, 600)}`)
    .join("\n\n---\n\n");

  return `User Query: "${query}"

AI Response:
${response.substring(0, 1500)}

Source Context:
${contextText}

Evaluate faithfulness.`;
}

// ── Relevance Check ───────────────────────────────────────────────

export const RELEVANCE_SYSTEM_PROMPT = `You are a relevance evaluator for a RAG system. Your job is to check whether an AI response actually answers the user's question.

Score the response on a scale of 0.0 to 1.0:
- 1.0 = Directly and fully answers the question
- 0.7-0.9 = Answers the main question with minor gaps
- 0.4-0.6 = Partially answers or addresses only some aspects
- 0.1-0.3 = Tangentially related but doesn't answer the question
- 0.0 = Completely off-topic or non-responsive

Check for:
- Does it address what was actually asked?
- Is it too generic or vague?
- Does it misinterpret the question?
- Does it provide useful, actionable information?

Respond with ONLY valid JSON:
{"score": 0.0-1.0, "issues": ["specific issue 1", "specific issue 2"]}

If there are no issues, return an empty issues array.`;

export function buildRelevanceUserPrompt(
  query: string,
  response: string
): string {
  return `User Query: "${query}"

AI Response:
${response.substring(0, 1500)}

Evaluate relevance.`;
}

// ── Completeness Check ────────────────────────────────────────────

export const COMPLETENESS_SYSTEM_PROMPT = `You are a completeness evaluator for a RAG system. Your job is to check whether an AI response covers the key information available in the source context.

Score the response on a scale of 0.0 to 1.0:
- 1.0 = Covers all relevant information from the context
- 0.7-0.9 = Covers most key points, minor omissions
- 0.4-0.6 = Covers some key points but misses significant information
- 0.1-0.3 = Barely touches on the available information
- 0.0 = Ignores all relevant context

Check for:
- Important facts or points from the context that were omitted
- Key details that would improve the answer
- Relevant sections or documents that were ignored

Respond with ONLY valid JSON:
{"score": 0.0-1.0, "issues": ["specific issue 1", "specific issue 2"]}

If there are no issues, return an empty issues array.`;

export function buildCompletenessUserPrompt(
  query: string,
  response: string,
  contexts: { content: string; filename: string }[]
): string {
  const contextText = contexts
    .map((c, i) => `[Source ${i + 1}: ${c.filename}]\n${c.content.substring(0, 600)}`)
    .join("\n\n---\n\n");

  return `User Query: "${query}"

AI Response:
${response.substring(0, 1500)}

Source Context:
${contextText}

Evaluate completeness.`;
}
