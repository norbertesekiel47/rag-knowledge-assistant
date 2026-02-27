import { SignIn } from "@clerk/nextjs";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#08080F] overflow-hidden">
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(168,85,247,0.15),rgba(217,70,239,0.06)_45%,transparent_70%)]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        {/* Brand header */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B2FBE] to-[#D946EF] flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            RAG Assistant
          </span>
        </Link>

        {/* Clerk sign-in card */}
        <SignIn />

        {/* Footer */}
        <p className="text-xs text-[#A1A1AA]/40">
          Secured by Clerk &middot; End-to-end encrypted
        </p>
      </div>
    </div>
  );
}
