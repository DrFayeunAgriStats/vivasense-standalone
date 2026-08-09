/**
 * Research Analysis History — centralized service (Phase 1).
 *
 * The ONE entry point the rest of the app uses:
 *   • recordAnalysis(input)        — persist exactly one row for an analysis run,
 *                                    successful or failed (see status below)
 *   • recordAnalysisFailure(input, error)
 *                                  — convenience wrapper for catch branches
 *   • listRecentAnalyses(limit)    — read the current user's history (newest first)
 *
 * Writes are best-effort and NEVER throw — a history failure must not break an
 * analysis flow. Persistence is Supabase-only; the Railway backend is untouched.
 * No Pro/subscription checks — history is free for every authenticated user.
 */

import { supabase } from "@/integrations/supabase/client";
import { insertHistoryRow, listHistoryByUser } from "./analysisHistoryApi";
import { buildHistoryRow } from "./historyMapper";
import type {
  AnalysisHistoryRecord,
  ProfileSnapshot,
  RecordAnalysisInput,
} from "./historyTypes";

/** VivaSense standalone app version (override via VITE_APP_VERSION at build time). */
export const FRONTEND_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) || "1.0.0-standalone";

const EMPTY_PROFILE: ProfileSnapshot = { institution: null, country: null, user_role: null };

// Per-session caches (module scope).
let profileCache: { userId: string; snapshot: ProfileSnapshot } | null = null;
const recentWrites = new Map<string, number>(); // dedupe guard: key -> last write ms

/** Resolve the authed user id + a cached profile snapshot, or null if signed out. */
async function resolveIdentity(): Promise<{ userId: string; snapshot: ProfileSnapshot } | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;

  if (profileCache && profileCache.userId === user.id) return profileCache;

  let snapshot: ProfileSnapshot = { ...EMPTY_PROFILE };
  try {
    // Standalone profiles have no FIA `academic_track`; use the researcher's
    // `position` as the user_role analytics dimension instead.
    const { data: p } = await supabase
      .from("profiles")
      .select("institution, country, position")
      .eq("id", user.id)
      .maybeSingle();
    if (p) {
      const row = p as Record<string, unknown>;
      snapshot = {
        institution: (row.institution as string | null) ?? null,
        country: (row.country as string | null) ?? null,
        user_role: (row.position as string | null) ?? null,
      };
    }
  } catch {
    // Profile snapshot is best-effort; a missing profile still records the analysis.
  }

  profileCache = { userId: user.id, snapshot };
  return profileCache;
}

function dedupeKey(i: RecordAnalysisInput): string {
  return [
    i.analysisType,
    i.datasetToken ?? i.datasetName ?? "",
    (i.traits ?? []).join(","),
    i.designType ?? "",
    // Status participates so a failure is never swallowed as a "duplicate" of a
    // preceding success on the same dataset (or vice versa) inside the window.
    i.status ?? "success",
  ].join("|");
}

/**
 * Persist exactly ONE history row for an analysis run.
 *
 * Call on BOTH outcomes:
 *   • success path  — omit `status` (defaults to 'success')
 *   • catch/failure — pass `status: 'failure'` plus `errorMessage`, or use the
 *     recordAnalysisFailure() wrapper below
 *
 * Recording failures is what makes the completion rate computable; before
 * 2026-08-08 a DB CHECK constraint allowed only 'success', so this function was
 * documented as success-only. That restriction is gone (migration
 * 20260808000100) and calling it from a catch branch is now correct.
 *
 * Silently ignores duplicate executions fired within a short window (guards
 * React StrictMode double-invoke). Never throws — a history failure must not
 * break, or mask, the analysis flow it is reporting on.
 */
export async function recordAnalysis(input: RecordAnalysisInput): Promise<void> {
  try {
    const key = dedupeKey(input);
    const now = Date.now();
    const last = recentWrites.get(key);
    if (last && now - last < 4000) return;
    recentWrites.set(key, now);

    const id = await resolveIdentity();
    if (!id) return; // not authenticated → nothing to persist

    const row = buildHistoryRow(input, id.userId, id.snapshot, FRONTEND_VERSION);
    await insertHistoryRow(row);
  } catch (err) {
    // History persistence is non-blocking by design.
    console.warn("[history] recordAnalysis skipped (non-blocking):", err);
  }
}

/**
 * Record a FAILED analysis run from a catch branch.
 *
 * Pass the same descriptive fields the success call site passes (analysisType,
 * backendEndpoint, dataset, traits, designType, startedAt, parameters) so the
 * two outcomes are directly comparable; `response` is deliberately not accepted
 * because a failed run has none worth extracting metrics from.
 */
export async function recordAnalysisFailure(
  input: Omit<RecordAnalysisInput, "status" | "response">,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  await recordAnalysis({ ...input, status: "failure", errorMessage: message });
}

/** Read the current user's most recent analyses. Returns [] when signed out or on error. */
export async function listRecentAnalyses(limit = 25): Promise<AnalysisHistoryRecord[]> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return [];
    return await listHistoryByUser(user.id, limit);
  } catch (err) {
    console.warn("[history] listRecentAnalyses returning empty:", err);
    return [];
  }
}

/** Distinguishes an empty history from a failed load so the UI can show an error state. */
export interface DashboardFetchResult {
  rows: AnalysisHistoryRecord[];
  /** null on success (including a legitimately empty result); a message on failure. */
  error: string | null;
  /** true only when there is no authenticated session. */
  signedOut: boolean;
}

/**
 * Fetch the current user's analyses for the Research Dashboard. Reuses the same
 * single Supabase query as listRecentAnalyses (via listHistoryByUser) but surfaces
 * errors instead of swallowing them, so the dashboard can render an error state.
 * All filtering/searching/grouping/pagination is done client-side on this result —
 * no additional Supabase queries.
 */
export async function fetchAnalysesForDashboard(limit = 200): Promise<DashboardFetchResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return { rows: [], error: null, signedOut: true };
    const rows = await listHistoryByUser(user.id, limit);
    return { rows, error: null, signedOut: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load analyses.";
    console.warn("[history] fetchAnalysesForDashboard failed:", err);
    return { rows: [], error: message, signedOut: false };
  }
}

/** Clear the cached profile snapshot (call on sign-out). */
export function clearHistoryProfileCache(): void {
  profileCache = null;
}
