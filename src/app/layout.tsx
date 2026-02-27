import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Knowledge Assistant",
  description: "Your personal AI-powered knowledge base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#A855F7",
          colorBackground: "#0E0E1A",
          colorText: "#FFFFFF",
          colorTextSecondary: "#A1A1AA",
          colorInputBackground: "#161625",
          colorInputText: "#FFFFFF",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "shadow-xl shadow-purple-500/5 border border-[#3F3F46]/50",
          headerTitle: "text-white font-bold",
          headerSubtitle: "text-[#A1A1AA]",
          socialButtonsBlockButton: {
            borderColor: "#3F3F46",
            color: "#FFFFFF",
          },
          socialButtonsBlockButtonText: {
            color: "#FFFFFF",
          },
          formButtonPrimary:
            "bg-gradient-to-r from-[#7B2FBE] via-[#A855F7] to-[#D946EF] hover:brightness-110 transition-all shadow-lg shadow-purple-500/20",
          footerActionLink: "text-[#A855F7] hover:text-[#D946EF]",
          formFieldInput:
            "border-[#3F3F46] focus:border-[#A855F7] focus:ring-[#A855F7]/20",
          dividerLine: "bg-[#3F3F46]",
          dividerText: "text-[#A1A1AA]/60",
          userButtonPopoverCard: "border border-[#3F3F46]/50",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-background text-foreground`}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
