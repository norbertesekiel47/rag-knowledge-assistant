import Groq from "groq-sdk";

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (groqClient) return groqClient;
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable");
  }
  
  groqClient = new Groq({ apiKey });
  return groqClient;
}

/**
 * Generate a concise, descriptive title for a chat based on the first message
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const client = getGroqClient();
    
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant", // Fast model for quick title generation
      messages: [
        {
          role: "system",
          content: `You are a title generator. Create a short, descriptive title (3-6 words) that summarizes the user's question or topic. 
          
Rules:
- Maximum 6 words
- No quotes or punctuation at the end
- Be specific and descriptive
- Use title case
- Don't start with "Question about" or "Help with"

Examples:
- "How do neural networks learn?" → "Neural Network Learning Process"
- "What's the best way to cook pasta?" → "Cooking Pasta Techniques"
- "Explain quantum computing basics" → "Quantum Computing Fundamentals"`,
        },
        {
          role: "user",
          content: `Generate a title for this message: "${firstMessage.slice(0, 200)}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 20,
    });

    const title = response.choices[0]?.message?.content?.trim() || "";
    
    // Clean up the title
    return cleanTitle(title) || fallbackTitle(firstMessage);
  } catch (error) {
    console.error("Error generating chat title:", error);
    return fallbackTitle(firstMessage);
  }
}

/**
 * Clean up generated title
 */
function cleanTitle(title: string): string {
  return title
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .replace(/[.!?]$/, "") // Remove ending punctuation
    .replace(/^(Title:|Here's a title:)/i, "") // Remove prefixes
    .trim()
    .slice(0, 50); // Max length
}

/**
 * Fallback title from first message
 */
function fallbackTitle(message: string): string {
  const words = message.trim().split(/\s+/).slice(0, 5);
  let title = words.join(" ");
  
  if (message.length > title.length) {
    title += "...";
  }
  
  return title.slice(0, 50);
}