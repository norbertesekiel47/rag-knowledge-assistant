"use client";

import { useState } from "react";
import { Search, Plus, Trash2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useChatSessions,
  groupSessionsByDate,
  type ChatSession,
} from "@/contexts/ChatSessionContext";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SessionAvatar({ title }: { title: string }) {
  const letter = title.charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center shrink-0 text-white text-sm font-semibold">
      {letter}
    </div>
  );
}

function SessionCard({
  session,
  isActive,
  onClick,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
        isActive
          ? "bg-sidebar-accent"
          : "hover:bg-sidebar-accent/50"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/4 h-1/2 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--gradient-start)] to-[var(--gradient-end)]" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            isActive ? "text-sidebar-foreground" : "text-muted-foreground"
          )}>
            {session.title}
          </span>
          <span className="text-[11px] text-muted-foreground/60 shrink-0">
            {formatRelativeTime(session.updated_at)}
          </span>
        </div>
      </div>

      {/* Three-dot menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ChatHistoryPanel() {
  const { sessions, currentSessionId, isLoading, selectSession, newChat, deleteSession } =
    useChatSessions();
  const [searchQuery, setSearchQuery] = useState("");

  const groupedSessions = groupSessionsByDate(sessions);

  const filteredGroups = searchQuery.trim()
    ? Object.fromEntries(
        Object.entries(groupedSessions)
          .map(([group, items]) => [
            group,
            items.filter((s) =>
              s.title.toLowerCase().includes(searchQuery.toLowerCase())
            ),
          ])
          .filter(([, items]) => (items as ChatSession[]).length > 0)
      )
    : groupedSessions;

  return (
    <div className="flex flex-col h-full w-[280px] bg-history-panel border-r border-sidebar-border">
      {/* Search bar */}
      <div className="p-3">
        <div className="flex items-center gap-2 bg-sidebar-accent rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-sidebar-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Messages</h2>
        <button
          onClick={newChat}
          className="w-7 h-7 rounded-lg bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center hover:brightness-110 transition shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Session list — plain div, NOT ScrollArea */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="space-y-2 px-1 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-10 h-10 rounded-full bg-sidebar-accent/50 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-sidebar-accent/50 rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-sidebar-accent/30 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-1">
            {Object.entries(filteredGroups).map(([dateGroup, groupSessions]) => (
              <div key={dateGroup}>
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 pt-3 pb-1">
                  {dateGroup}
                </p>
                {(groupSessions as ChatSession[]).map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isActive={currentSessionId === session.id}
                    onClick={() => selectSession(session.id)}
                    onDelete={() => deleteSession(session.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
