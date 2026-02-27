import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Spline from "@splinetool/react-spline/next";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="landing-grid-bg relative min-h-screen overflow-hidden text-white">
      {/* Grid overlay with fade */}
      <div className="landing-grid-fade pointer-events-none absolute inset-0" />

      {/* Ambient glow */}
      <div className="landing-glow pointer-events-none absolute inset-0" />

      {/* Spline 3D — full-viewport with compressed cursor tracking */}
      <div
        className="absolute inset-0 z-0"
        style={{
          maskImage: "linear-gradient(to right, transparent 35%, black 62%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 35%, black 62%)",
        }}
      >
        <Spline scene="https://prod.spline.design/vrt7CFWotMXUQQMz/scene.splinecode" />
      </div>

      {/* Navigation */}
      <nav className="pointer-events-none relative z-10 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20">
        <span className="text-lg font-bold tracking-tight text-white">
          RAG Assistant
        </span>
      </nav>

      {/* Hero section */}
      <main className="pointer-events-none relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-4 md:px-12 md:pt-6 lg:grid-cols-2 lg:px-20 lg:pt-8">
        {/* Left — Copy */}
        <div className="max-w-xl">
          <div className="landing-animate mb-8">
            <span className="landing-badge inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide">
              AI-Powered Knowledge Base
            </span>
          </div>

          <h1 className="landing-animate-delay-1 mb-6 text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl lg:text-7xl">
            Your personal
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">knowledge</span>
            <br />
            assistant
          </h1>

          <p className="landing-animate-delay-2 mb-10 max-w-md text-base leading-relaxed text-[#A1A1AA] md:text-lg">
            Upload documents, search semantically, and chat with an AI that
            truly understands your data. Powered by retrieval-augmented
            generation for accurate, context-aware answers.
          </p>

          <div className="landing-animate-delay-3 pointer-events-auto flex items-center gap-4">
            <Link
              href="/sign-up"
              className="landing-btn-primary rounded-full px-7 py-3 text-sm font-semibold"
            >
              Get started free
            </Link>
            <Link
              href="/sign-in"
              className="landing-btn-secondary rounded-full px-7 py-3 text-sm font-semibold"
            >
              Sign in &rarr;
            </Link>
          </div>
        </div>

        {/* Right — spacer so grid stays 2-col; Spline renders as full-viewport layer above */}
        <div className="hidden lg:block" />
      </main>

      {/* Footer */}
      <footer className="pointer-events-none relative z-10 mt-auto">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-32 md:px-12 lg:px-20">
          <div className="flex flex-col items-center justify-between gap-6 border-t border-[#3F3F46]/50 pt-8 md:flex-row">
            <p className="text-sm text-[#A1A1AA]/60">
              Made by{" "}
              <span className="font-medium text-[#D4D4D8]">
                <a href="https://github.com/norbertesekiel47" target="_blank" rel="noopener noreferrer" className="pointer-events-auto hover:underline">
                  @norbertesekiel
                </a>
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
