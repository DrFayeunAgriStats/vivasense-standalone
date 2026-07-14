/**
 * Research Analysis History — thin Supabase data-access layer (Phase 1).
 *
 * No business logic here: just insert/select against public.analysis_history.
 * Row Level Security enforces per-user isolation server-side.
 */

import { supabase } from "@/integrations/supabase/client";
import type { AnalysisHistoryRecord, NewAnalysisHistoryRow } from "./historyTypes";

const TABLE = "analysis_history";

/** Insert a single history row. Throws on error (caller decides how to handle). */
export async function insertHistoryRow(row: NewAnalysisHistoryRow): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from(TABLE).insert(row as any);
  if (error) throw error;
}

/** List a user's most recent analyses, newest first. RLS also restricts to the caller. */
export async function listHistoryByUser(
  userId: string,
  limit = 25,
): Promise<AnalysisHistoryRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AnalysisHistoryRecord[];
}
