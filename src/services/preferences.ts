/**
 * User preferences persisted on the profiles row (per-user, cross-device).
 * Phase 1 has exactly one: the Workspace onboarding-cards dismissal.
 */
import { supabase } from "@/integrations/supabase/client";

/** Persist that the current user dismissed the onboarding module cards. */
export async function dismissOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_dismissed: true } as never)
    .eq("id", userId);
  if (error) {
    // Non-fatal: the UI still hides the cards for this session.
    console.warn("[preferences] could not persist onboarding dismissal:", error.message);
  }
}
