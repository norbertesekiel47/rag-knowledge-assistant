import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { SearchView } from "@/components/search/SearchView";

export default async function SearchPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "processed")
    .order("created_at", { ascending: false });

  return <SearchView initialDocuments={documents || []} />;
}
