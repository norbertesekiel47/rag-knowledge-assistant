"use client";

import { ChatInterface } from "./ChatInterface";
import { useEmbeddingProvider } from "@/contexts/EmbeddingContext";
import { useChatSessions } from "@/contexts/ChatSessionContext";
import type { Document } from "@/lib/supabase/types";

interface ChatViewProps {
  initialDocuments: Document[];
}

export function ChatView({ initialDocuments }: ChatViewProps) {
  const { provider } = useEmbeddingProvider();
  const { currentSessionId, onSessionCreated } = useChatSessions();

  const filteredDocuments = initialDocuments.filter(
    (doc) => doc.embedding_provider === provider
  );

  const hasProcessedDocuments = filteredDocuments.length > 0;

  if (!hasProcessedDocuments) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="text-center max-w-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">No documents yet</h2>
          <p className="text-muted-foreground">
            Upload and process documents to start chatting with your knowledge base.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatInterface
        sessionId={currentSessionId}
        onSessionCreated={onSessionCreated}
        embeddingProvider={provider}
        documents={filteredDocuments}
      />
    </div>
  );
}
