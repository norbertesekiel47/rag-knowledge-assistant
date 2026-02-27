"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSessionContextType {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  selectSession: (id: string) => void;
  newChat: () => void;
  deleteSession: (id: string) => Promise<void>;
  onSessionCreated: (id: string) => void;
  refreshSessions: () => Promise<void>;
}

const ChatSessionContext = createContext<ChatSessionContextType | undefined>(undefined);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const newChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setCurrentSessionId((prev) => (prev === sessionId ? null : prev));
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }, []);

  const onSessionCreated = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    refreshSessions();
  }, [refreshSessions]);

  return (
    <ChatSessionContext.Provider
      value={{
        sessions,
        currentSessionId,
        isLoading,
        selectSession,
        newChat,
        deleteSession,
        onSessionCreated,
        refreshSessions,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSessions() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error("useChatSessions must be used within ChatSessionProvider");
  return ctx;
}

// Helper to group sessions by relative date
export function groupSessionsByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const groups: Record<string, ChatSession[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const session of sessions) {
    const sessionDate = new Date(session.updated_at);
    let group: string;

    if (sessionDate >= today) {
      group = "Today";
    } else if (sessionDate >= yesterday) {
      group = "Yesterday";
    } else if (sessionDate >= lastWeek) {
      group = "Last 7 Days";
    } else {
      group = "Older";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(session);
  }

  return groups;
}
