"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignOutButton } from "@clerk/nextjs";
import {
  MessageSquare,
  Search,
  FileText,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatSessions, groupSessionsByDate } from "@/contexts/ChatSessionContext";

const navItems = [
  { href: "/dashboard", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/search", label: "Search", icon: Search },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function UserArea({ collapsed }: { collapsed: boolean }) {
  const { user } = useUser();

  return (
    <div className="p-3 space-y-1">
      <div className="flex items-center gap-3">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-7 w-7 rounded-full shrink-0"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-sidebar-accent shrink-0" />
        )}
        {!collapsed && (
          <span className="text-sm text-sidebar-foreground truncate flex-1">
            {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Account"}
          </span>
        )}
      </div>
      {!collapsed && (
        <SignOutButton redirectUrl="/">
          <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </SignOutButton>
      )}
      {collapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <SignOutButton redirectUrl="/">
              <button className="flex items-center justify-center w-full p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </SignOutButton>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
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
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
            RAG Assistant
          </span>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className={cn(
              "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed ? "mx-auto" : "ml-auto"
            )}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 space-y-1">
        {navItems.map((item) => (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">{item.label}</TooltipContent>
            )}
          </Tooltip>
        ))}
      </nav>

      {/* Chat Sessions (visible on chat route when not collapsed) */}
      {isChatRoute && !collapsed && (
        <>
          <Separator className="bg-sidebar-border" />
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              History
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={newChat}
              className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 px-2">
            {isLoading ? (
              <div className="space-y-2 px-1">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-sidebar-accent/50" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-3 pb-2">
                {Object.entries(groupedSessions).map(([dateGroup, groupSessions]) => (
                  <div key={dateGroup}>
                    <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1">
                      {dateGroup}
                    </p>
                    <div className="space-y-0.5">
                      {groupSessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => selectSession(session.id)}
                          className={cn(
                            "group relative px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                            currentSessionId === session.id
                              ? "bg-sidebar-accent text-sidebar-foreground"
                              : "hover:bg-sidebar-accent/50 text-muted-foreground hover:text-sidebar-foreground"
                          )}
                        >
                          <span className="block truncate text-sm pr-7">
                            {session.title}
                          </span>
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
                                  deleteSession(session.id);
                                }}
                                className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* Spacer when not on chat route */}
      {(!isChatRoute || collapsed) && <div className="flex-1" />}

      <Separator className="bg-sidebar-border" />

      {/* User area */}
      <UserArea collapsed={collapsed} />
    </div>
  );
}
