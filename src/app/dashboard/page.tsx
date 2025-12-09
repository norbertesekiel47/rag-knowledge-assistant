import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { createServiceClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  
  // Test: Fetch user from Supabase
  const supabase = createServiceClient();
  const { data: supabaseUser, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

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
            Your personal AI knowledge base is ready.
          </p>

          <div className="mt-6 p-4 bg-blue-50 rounded-md space-y-2">
            <p className="text-sm text-blue-800">
              <strong>Debug Info:</strong>
            </p>
            <p className="text-sm text-blue-700">
              Clerk User ID: <code className="bg-blue-100 px-1 rounded">{userId}</code>
            </p>
            <p className="text-sm text-blue-700">
              Supabase Sync: {supabaseUser ? (
                <span className="text-green-600 font-medium">✓ Connected</span>
              ) : (
                <span className="text-red-600 font-medium">✗ Not found ({error?.message})</span>
              )}
            </p>
            {supabaseUser && (
              <p className="text-sm text-blue-700">
                Supabase Email: <code className="bg-blue-100 px-1 rounded">{supabaseUser.email}</code>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}