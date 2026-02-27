import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deleteAllUserChunks } from "@/lib/weaviate/vectors";
import { logger } from "@/lib/utils/logger";

export async function POST(req: Request) {
  // Get the webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET to .env.local");
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error("Error verifying webhook", "clerk-webhook", {
      error: err instanceof Error ? { message: err.message } : { error: String(err) },
    });
    return new Response("Error: Verification failed", {
      status: 400,
    });
  }

  // Handle the webhook event
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;

    if (!primaryEmail) {
      logger.error("No email address found for user", "clerk-webhook", {
        userId: id,
      });
      return new Response("Error: No email address", { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert user (insert or update if exists)
    const now = new Date().toISOString();
    const { error } = await supabase.from("users").upsert(
      {
        id: id,
        email: primaryEmail,
        created_at: now,
        updated_at: now,
      },
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      logger.error("Error upserting user to Supabase", "clerk-webhook", {
        error: { message: error.message },
      });
      return new Response("Error: Database operation failed", { status: 500 });
    }

    logger.info(`User ${eventType === "user.created" ? "created" : "updated"}: ${id}`, "clerk-webhook");
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    if (!id) {
      return new Response("Error: No user ID", { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Delete all vector data from Weaviate + pgvector (before DB cascade)
    try {
      await deleteAllUserChunks(id);
    } catch (err) {
      logger.error("Weaviate/pgvector cleanup failed (continuing)", "clerk-webhook", {
        error: err instanceof Error ? { message: err.message } : { error: String(err) },
      });
    }

    // 2. Explicitly delete from tables that may lack CASCADE constraints
    //    (chunk_feedback_scores is a VIEW on chunk_feedback, not a table)
    const orphanTables = [
      "chunk_feedback",
      "analytics_document_usage",
      "analytics_daily_stats",
    ] as const;

    for (const table of orphanTables) {
      const { error: cleanupErr } = await supabase
        .from(table)
        .delete()
        .eq("user_id", id);
      if (cleanupErr) {
        logger.warn(`Cleanup of ${table} failed (continuing)`, "clerk-webhook", {
          error: { message: cleanupErr.message },
        });
      }
    }

    // 3. Delete user row — CASCADE handles documents, sessions, messages, etc.
    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) {
      logger.error("Error deleting user from Supabase", "clerk-webhook", {
        error: { message: error.message },
      });
      return new Response("Error: Database operation failed", { status: 500 });
    }

    logger.info(`User deleted with full cleanup: ${id}`, "clerk-webhook");
  }

  return new Response("Webhook processed", { status: 200 });
}
