"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0E0E1A] text-white flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full mx-auto p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-zinc-400 text-sm mb-6">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-zinc-600 text-xs mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#7B2FBE] via-[#A855F7] to-[#D946EF] text-white font-medium text-sm hover:brightness-110 transition-all shadow-lg shadow-purple-500/20"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
