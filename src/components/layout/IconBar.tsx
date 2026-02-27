"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk, SignOutButton } from "@clerk/nextjs";
import {
  MessageSquare,
  Search,
  FileText,
  BarChart3,
  LogOut,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/search", label: "Search", icon: Search },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

export function IconBar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col items-center h-full w-[60px] bg-icon-bar border-r border-sidebar-border py-4">
      {/* Logo */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-end)] flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
        <MessageSquare className="w-5 h-5 text-white" />
      </div>

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1.5 flex-1">
        {navItems.map((item) => (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-accent text-[var(--gradient-mid)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {isActive(item.href) && (
                  <span className="absolute left-0 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-[var(--gradient-start)] to-[var(--gradient-end)]" />
                )}
                <item.icon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ))}
      </nav>

      {/* User avatar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-transparent hover:ring-[var(--gradient-mid)]/30 transition-all">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-foreground">
                {user?.firstName?.[0] || "U"}
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-44">
          <DropdownMenuItem onClick={() => openUserProfile()}>
            <UserCog className="h-4 w-4 mr-2" />
            Manage account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <SignOutButton redirectUrl="/">
              <button className="flex items-center gap-2 w-full text-sm">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </SignOutButton>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
