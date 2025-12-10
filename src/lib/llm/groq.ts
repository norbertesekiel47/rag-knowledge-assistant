import Groq from "groq-sdk";
import { LLMProvider, LLMMessage, StreamCallbacks, MODEL_IDS } from "./types";

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (groqClient) {
    return groqClient;
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable");
  }

  groqClient = new Groq({ apiKey });
  return groqClient;
}

/**
 * Remove <think>...</think> blocks from response
 * Some models (like Qwen) include reasoning in these tags
 */
function stripThinkingTags(text: string): string {
  // Remove <think>...</think> blocks (including multiline)
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export async function streamGroqResponse(
  provider: LLMProvider,
  systemPrompt: string,
  messages: LLMMessage[],
  callbacks: StreamCallbacks,
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<void> {
  const client = getGroqClient();
  const modelId = MODEL_IDS[provider];

  try {
    const stream = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    let fullResponse = "";
    let isInsideThinkTag = false;
    let thinkBuffer = "";

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullResponse += token;

        // Check if we're entering a <think> tag
        if (fullResponse.includes("<think>") && !fullResponse.includes("</think>")) {
          isInsideThinkTag = true;
        }

        // Check if we've exited the </think> tag
        if (fullResponse.includes("</think>")) {
          isInsideThinkTag = false;
          // Once we exit, send the cleaned content so far
          const cleanedSoFar = stripThinkingTags(fullResponse);
          if (cleanedSoFar && thinkBuffer !== cleanedSoFar) {
            // Send the difference
            const newContent = cleanedSoFar.slice(thinkBuffer.length);
            if (newContent) {
              callbacks.onToken(newContent);
            }
            thinkBuffer = cleanedSoFar;
          }
        } else if (!isInsideThinkTag) {
          // Only send tokens if we're not inside a think tag
          callbacks.onToken(token);
        }
      }
    }

    // Final cleanup and send complete response
    const cleanedResponse = stripThinkingTags(fullResponse);
    callbacks.onComplete(cleanedResponse);
  } catch (error) {
    console.error("Groq streaming error:", error);
    callbacks.onError(
      error instanceof Error ? error : new Error("Groq streaming failed")
    );
  }
}