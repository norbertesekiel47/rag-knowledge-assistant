"use client";

import { usePathname } from "next/navigation";
import { IconBar } from "./IconBar";
import { ChatHistoryPanel } from "./ChatHistoryPanel";
import { MobileSidebar } from "./MobileSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { EmbeddingProviderProvider } from "@/contexts/EmbeddingContext";
import { ChatSessionProvider } from "@/contexts/ChatSessionContext";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = pathname === "/dashboard";

  return (
    <EmbeddingProviderProvider>
      <ChatSessionProvider>
        <div className="flex h-screen bg-background">
          {/* Desktop: Icon bar + optional chat history panel */}
          <div className="hidden md:flex">
            <IconBar />
            {isChatRoute && <ChatHistoryPanel />}
          </div>

          {/* Mobile: Hamburger + Sheet */}
          <div className="md:hidden fixed top-4 left-4 z-50">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation menu"
                  className="text-foreground bg-card/80 backdrop-blur-sm border border-border"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
                <MobileSidebar />
              </SheetContent>
            </Sheet>
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-hidden relative">
            {/* Dot-grid background */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />
            {/* Subtle ambient glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.08),transparent_50%)]" />
            <div className="relative h-full">{children}</div>
          </main>
        </div>
      </ChatSessionProvider>
    </EmbeddingProviderProvider>
  );
}
