import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";

export default async function DashboardPage() {
  // Get the userId from auth — this runs on the server
  const { userId } = await auth();

  // Double-check auth (middleware should handle this, but defense in depth)
  if (!userId) {
    redirect("/sign-in");
  }

  // Get full user object for display
  const user = await currentUser();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Knowledge Assistant
          </h1>
          <SignOutButton>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Sign Out
            </button>
          </SignOutButton>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Welcome, {user?.firstName || "User"}!
          </h2>
          <p className="text-gray-600 mb-4">
            Your personal AI knowledge base is ready. In the next phases, you will be able to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Upload documents (PDF, Markdown, Text)</li>
            <li>Search your knowledge base semantically</li>
            <li>Chat with AI that understands your documents</li>
          </ul>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Debug Info (remove in production):</strong>
              <br />
              User ID: <code className="bg-blue-100 px-1 rounded">{userId}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}