import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
);

export type SessionRow = {
  id?: string;
  type: "phone" | "meeting";
  caller_number?: string;
  meeting_url?: string;
  transcript: { role: string; content: string; speaker?: string; timestamp?: string }[];
  started_at: string;
  ended_at: string;
};

export async function saveSession(session: SessionRow): Promise<void> {
  const { error } = await supabase.from("sessions").insert(session);
  if (error) {
    console.error("[supabase] Failed to save session:", error.message);
  } else {
    console.log(`[supabase] Saved ${session.type} session`);
  }
}
