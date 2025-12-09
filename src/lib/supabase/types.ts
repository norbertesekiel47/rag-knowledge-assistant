// Database types - these match our schema
export type DocumentStatus = "pending" | "processing" | "processed" | "failed";
export type MessageRole = "user" | "assistant";
export type LLMModel = "claude" | "gemini";

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  sources: MessageSource[];
  model: LLMModel | null;
  created_at: string;
}

export interface MessageSource {
  documentId: string;
  chunkId: string;
  snippet: string;
}