"use client";

import { useState } from "react";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isLoading,
}: ChatSidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Group sessions by date
  const groupedSessions = groupSessionsByDate(sessions);

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === sessionId) {
      onDeleteSession(sessionId);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(sessionId);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* New Chat Button */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSessions).map(([dateGroup, groupSessions]) => (
              <div key={dateGroup}>
                <p className="text-xs font-medium text-gray-500 px-2 mb-1">
                  {dateGroup}
                </p>
                <div className="space-y-1">
                  {groupSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`
                        group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                        transition-colors text-sm
                        ${
                          currentSessionId === session.id
                            ? "bg-blue-100 text-blue-900"
                            : "hover:bg-gray-100 text-gray-700"
                        }
                      `}
                    >
                      <span className="truncate flex-1">{session.title}</span>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className={`
                          ml-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
                          ${
                            deleteConfirm === session.id
                              ? "bg-red-100 text-red-600 opacity-100"
                              : "hover:bg-gray-200 text-gray-500"
                          }
                        `}
                        title={deleteConfirm === session.id ? "Click again to confirm" : "Delete"}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to group sessions by relative date
function groupSessionsByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
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