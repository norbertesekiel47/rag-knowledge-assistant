"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk, SignOutButton } from "@clerk/nextjs";
import {
  MessageSquare,
  Search,
  FileText,
  BarChart3,
  Plus,
  Trash2,
  LogOut,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  useChatSessions,
  groupSessionsByDate,
} from "@/contexts/ChatSessionContext";

const navItems = [
  { href: "/dashboard", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/search", label: "Search", icon: Search },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

export function MobileSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const { sessions, currentSessionId, isLoading, selectSession, newChat, deleteSession } =
    useChatSessions();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isChatRoute = pathname === "/dashboard";
  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center mr-3">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
          RAG Assistant
        </span>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            {isActive(item.href) && (
              <span className="absolute left-0 top-1/4 h-1/2 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--gradient-start)] to-[var(--gradient-end)]" />
            )}
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive(item.href) && "text-[var(--gradient-mid)]"
              )}
            />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Chat history on chat route */}
      {isChatRoute && (
        <>
          <Separator className="bg-sidebar-border" />
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              History
            </span>
            <button
              onClick={newChat}
              className="w-6 h-6 rounded-md bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center"
            >
              <Plus className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {isLoading ? (
              <div className="space-y-2 px-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 w-full bg-sidebar-accent/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {Object.entries(groupedSessions).map(([dateGroup, groupSessions]) => (
                  <div key={dateGroup}>
                    <p className="text-[11px] font-medium text-muted-foreground/60 px-2 pt-2 pb-1">
                      {dateGroup}
                    </p>
                    {groupSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => selectSession(session.id)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                          currentSessionId === session.id
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "hover:bg-sidebar-accent/50 text-muted-foreground"
                        )}
                      >
                        <span className="truncate flex-1">{session.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className="ml-2 p-1 rounded text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Spacer when not on chat route */}
      {!isChatRoute && <div className="flex-1" />}

      <Separator className="bg-sidebar-border" />

      {/* User area */}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-3">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="h-7 w-7 rounded-full shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-sidebar-accent shrink-0" />
          )}
          <span className="text-sm text-sidebar-foreground truncate flex-1">
            {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Account"}
          </span>
        </div>
        <button
          onClick={() => openUserProfile()}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <UserCog className="h-3.5 w-3.5" />
          Manage account
        </button>
        <SignOutButton redirectUrl="/">
          <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
