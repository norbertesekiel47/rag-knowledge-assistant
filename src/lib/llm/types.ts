export type LLMProvider = "llama-70b" | "llama-8b" | "qwen-32b";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export interface RAGContext {
  content: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

// Model IDs for Groq - Updated December 2025
export const MODEL_IDS: Record<LLMProvider, string> = {
  "llama-70b": "llama-3.3-70b-versatile",
  "llama-8b": "llama-3.1-8b-instant",
  "qwen-32b": "qwen/qwen3-32b",
};

// Display names for UI
export const MODEL_NAMES: Record<LLMProvider, string> = {
  "llama-70b": "Llama 3.3 70B (Best)",
  "llama-8b": "Llama 3.1 8B (Fast)",
  "qwen-32b": "Qwen3 32B (Balanced)",
};