/**
 * Research Dashboard — pure, side-effect-free helpers (Phase 2).
 *
 * Filtering, searching, grouping, statistics, and formatting for the analysis
 * history dashboard. Every value here is derived from real analysis_history rows;
 * nothing is mocked, hardcoded, or fabricated. No data access lives here — the
 * caller passes rows fetched via historyService.
 */

import type { AnalysisHistoryRecord, AnalysisTypeId } from "./historyTypes";
import { analysisLabel } from "./historyMapper";

// ── Filter option catalogs ───────────────────────────────────────────────────

/** All analysis types offered in the type filter (id + human label). */
export const ANALYSIS_TYPE_OPTIONS: { id: AnalysisTypeId; label: string }[] = [
  { id: "anova", label: "ANOVA" },
  { id: "correlation", label: "Correlation" },
  { id: "genetic_parameters", label: "Genetic Parameters" },
  { id: "regression", label: "Regression" },
  { id: "blup", label: "BLUP" },
  { id: "pca", label: "PCA" },
  { id: "cluster", label: "Cluster" },
  { id: "path_analysis", label: "Path Analysis" },
  { id: "selection_index", label: "Selection Index" },
  { id: "stability", label: "Stability" },
  { id: "trait_association", label: "Trait Association" },
];

export type DateRangeId = "all" | "today" | "7d" | "30d";

export const DATE_RANGE_OPTIONS: { id: DateRangeId; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export interface DashboardFilters {
  /** "all" or a specific analysis type id. */
  type: "all" | AnalysisTypeId;
  dateRange: DateRangeId;
  /** Free-text search over dataset name, study name, and analysis title. */
  search: string;
}

export const DEFAULT_FILTERS: DashboardFilters = { type: "all", dateRange: "all", search: "" };

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days between two calendar dates (ignoring time-of-day). */
function calendarDaysAgo(created: Date, now: Date): number {
  const ms = startOfDay(now).getTime() - startOfDay(created).getTime();
  return Math.round(ms / 86_400_000);
}

function withinRange(iso: string, range: DateRangeId, now: Date): boolean {
  if (range === "all") return true;
  const created = new Date(iso);
  if (isNaN(created.getTime())) return false;
  const days = calendarDaysAgo(created, now);
  if (range === "today") return days === 0;
  if (range === "7d") return days <= 6; // today + previous 6 calendar days
  if (range === "30d") return days <= 29;
  return true;
}

// ── Filtering + searching ────────────────────────────────────────────────────

function matchesSearch(r: AnalysisHistoryRecord, needle: string): boolean {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const haystack = [r.dataset_name, r.study_name, r.analysis_title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Apply type, date-range, and search filters. Pure; input is never mutated. */
export function filterRecords(
  records: AnalysisHistoryRecord[],
  filters: DashboardFilters,
  now: Date = new Date(),
): AnalysisHistoryRecord[] {
  return records.filter((r) => {
    if (filters.type !== "all" && r.analysis_type !== filters.type) return false;
    if (!withinRange(r.created_at, filters.dateRange, now)) return false;
    if (!matchesSearch(r, filters.search)) return false;
    return true;
  });
}

// ── Grouping ─────────────────────────────────────────────────────────────────

export type GroupKey = "today" | "yesterday" | "this_week" | "this_month" | "older";

export const GROUP_ORDER: GroupKey[] = ["today", "yesterday", "this_week", "this_month", "older"];

export const GROUP_LABELS: Record<GroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "Earlier This Week",
  this_month: "Earlier This Month",
  older: "Older",
};

export function groupKeyFor(iso: string, now: Date = new Date()): GroupKey {
  const created = new Date(iso);
  if (isNaN(created.getTime())) return "older";
  const days = calendarDaysAgo(created, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 6) return "this_week";
  if (days <= 29) return "this_month";
  return "older";
}

export interface AnalysisGroup {
  key: GroupKey;
  label: string;
  records: AnalysisHistoryRecord[];
}

/**
 * Group records into Today / Yesterday / Earlier This Week / Earlier This Month /
 * Older, in that fixed order. Records within a group keep their incoming order
 * (callers pass newest-first). Empty groups are omitted.
 */
export function groupRecords(
  records: AnalysisHistoryRecord[],
  now: Date = new Date(),
): AnalysisGroup[] {
  const buckets = new Map<GroupKey, AnalysisHistoryRecord[]>();
  for (const r of records) {
    const key = groupKeyFor(r.created_at, now);
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  return GROUP_ORDER.filter((k) => (buckets.get(k)?.length ?? 0) > 0).map((k) => ({
    key: k,
    label: GROUP_LABELS[k],
    records: buckets.get(k)!,
  }));
}

// ── Statistics (real, derived) ───────────────────────────────────────────────

export interface DashboardStats {
  total: number;
  uniqueDatasets: number;
  studies: number;
  /** Mean execution_time_ms across rows that recorded one; null if none did. */
  avgRuntimeMs: number | null;
}

/** Compute header statistics straight from the rows. No hardcoded values. */
export function computeStats(records: AnalysisHistoryRecord[]): DashboardStats {
  const datasets = new Set<string>();
  const studies = new Set<string>();
  let runtimeSum = 0;
  let runtimeCount = 0;

  for (const r of records) {
    if (r.dataset_name) datasets.add(r.dataset_name);
    if (r.study_name) studies.add(r.study_name);
    if (typeof r.execution_time_ms === "number" && r.execution_time_ms >= 0) {
      runtimeSum += r.execution_time_ms;
      runtimeCount += 1;
    }
  }

  return {
    total: records.length,
    uniqueDatasets: datasets.size,
    studies: studies.size,
    avgRuntimeMs: runtimeCount > 0 ? Math.round(runtimeSum / runtimeCount) : null,
  };
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Human duration from milliseconds, e.g. "820 ms", "3.1 s", "1 m 5 s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(totalSec < 10 ? 1 : 0)} s`;
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m} m ${s} s`;
}

/** Pretty design label, e.g. "split_plot_rcbd" → "split plot rcbd". */
export function formatDesign(design: string | null | undefined): string {
  if (!design) return "—";
  return design.replace(/_/g, " ");
}

/** Re-export the shared type label so components import a single source. */
export { analysisLabel };
