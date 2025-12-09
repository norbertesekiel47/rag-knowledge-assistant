import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is already signed in, send them to dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-5xl font-bold text-gray-900 text-center mb-6">
          Knowledge Assistant
        </h1>
        <p className="text-xl text-gray-600 text-center mb-8">
          Your personal AI-powered knowledge base. Upload documents, search semantically, and chat with AI that understands your data.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}