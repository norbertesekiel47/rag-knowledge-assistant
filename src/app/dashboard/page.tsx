import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/ChatView";

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "processed")
    .order("created_at", { ascending: false });

  return <ChatView initialDocuments={documents || []} />;
}
