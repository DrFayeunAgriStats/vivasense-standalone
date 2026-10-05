/**
 * FE-BETA-02 — Early Access frontend/backend contract alignment.
 *
 * Pure presentation helpers. Nothing here performs statistical inference: every
 * number, decision and label comes from the backend payload, and these
 * functions only choose how to show it. In particular there is deliberately no
 * CV, F, p-value or grouping computation in this file.
 *
 * Contract target: backend release candidate 9544b56221d541d0d27829dda865260c6272cfc4.
 */

import type { GovernedDesignType } from "./anovaDesigns";

// ── 1. Design default from the block mapping ─────────────────────────────────

/**
 * The design a freshly mapped dataset should open on.
 *
 * An explicit "None" for Replication / Block means the experiment has no block,
 * which is a CRD. Retaining a stale RCBD selection there is what produced the
 * "CRD selected, RCBD analysed" confusion in the student test.
 */
export function defaultDesignForBlockMapping(repColumn: string | null | undefined): GovernedDesignType {
  return (repColumn ?? "").trim().length > 0 ? "rcbd" : "crd";
}

// ── 2/3. ANOVA row labels and significance emphasis ──────────────────────────

export interface AnovaTableLike {
  source?: unknown;
  display_source?: unknown;
}

const REPLICATION_SOURCE = /^(rep|reps|block|blocks|replication|replications|replicate|replicates)$/i;
const ERROR_SOURCE = /^(residual|residuals|error|error a|error b|within|total)$/i;

/** Legacy labels for payloads that predate `display_source`. */
function legacySourceLabel(source: string): string {
  const key = source.trim();
  if (/^genotype$/i.test(key)) return "Treatment";
  if (REPLICATION_SOURCE.test(key)) return "Replication / Block";
  return key;
}

/**
 * Researcher-facing ANOVA row labels.
 *
 * `anova_table.display_source` is authoritative whenever the backend supplies a
 * label for the row. The internal keys (`genotype`, `rep`) are never shown when
 * a display label exists. Rows the backend left blank, or a payload without
 * `display_source` at all, fall back per-row to a neutral legacy label.
 */
export function resolveAnovaSourceLabels(table: AnovaTableLike | null | undefined): string[] {
  const sources = Array.isArray(table?.source) ? (table!.source as unknown[]).map((s) => String(s ?? "")) : [];
  const display = Array.isArray(table?.display_source) ? (table!.display_source as unknown[]) : [];
  return sources.map((source, i) => {
    const supplied = display[i];
    if (typeof supplied === "string" && supplied.trim().length > 0) return supplied.trim();
    return legacySourceLabel(source);
  });
}

/**
 * Raw source key → researcher-facing label.
 *
 * Keyed by the raw source rather than the row index because the renderer drops
 * the intercept row, which would otherwise shift every following label.
 */
export function anovaSourceLabelMap(table: AnovaTableLike | null | undefined): Map<string, string> {
  const sources = Array.isArray(table?.source) ? (table!.source as unknown[]).map((s) => String(s ?? "")) : [];
  const labels = resolveAnovaSourceLabels(table);
  return new Map(sources.map((source, i) => [source, labels[i]]));
}

/** True for the replication / block row, judged from the RAW backend source key. */
export function isReplicationSource(rawSource: unknown): boolean {
  return REPLICATION_SOURCE.test(String(rawSource ?? "").trim());
}

/**
 * Whether an ANOVA row's p-value is styled as a treatment finding.
 *
 * Replication / block rows are never emphasised, even with a small p-value: a
 * block effect is a nuisance term, not a treatment result. The numeric p-value
 * itself is always still shown by the caller — this only governs styling.
 */
export function emphasiseAnovaRow(rawSource: unknown, pValue: unknown, alpha: number): boolean {
  if (isReplicationSource(rawSource)) return false;
  if (ERROR_SOURCE.test(String(rawSource ?? "").trim())) return false;
  if (pValue === null || pValue === undefined || pValue === "") return false;
  const p = Number(pValue);
  return Number.isFinite(p) && p <= alpha;
}

// ── 4 (CV). Backend-provided CV only ─────────────────────────────────────────

/**
 * The experimental CV% exactly as the backend supplied it.
 *
 * Reads `result.descriptive_stats.cv_percent` and nothing else. It is NEVER
 * derived from the ANOVA table here: the validated /genetics/analyze-upload
 * payload does not currently carry a one-factor CV, and computing one in the
 * browser would be a client-side statistic. Returns null when absent.
 */
export function readBackendCvPercent(result: unknown): number | null {
  const stats = (result as { descriptive_stats?: { cv_percent?: unknown } | null } | null | undefined)
    ?.descriptive_stats;
  const raw = stats?.cv_percent;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

// ── 5. Level order ───────────────────────────────────────────────────────────

export type LevelOrder = Partial<Record<
  "treatment" | "block" | "factor_a" | "factor_b" | "main_plot" | "sub_plot",
  string[]
>>;

export function readLevelOrder(result: unknown): LevelOrder {
  const raw = (result as { level_order?: unknown } | null | undefined)?.level_order;
  if (!raw || typeof raw !== "object") return {};
  const out: LevelOrder = {};
  for (const [role, levels] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(levels) && levels.length > 0) {
      (out as Record<string, string[]>)[role] = levels.map((l) => String(l));
    }
  }
  return out;
}

/**
 * Order unranked categorical items by the backend `level_order`.
 *
 * Items whose key is not in `order` keep their relative position after the
 * ordered ones. When no order is supplied the input is returned untouched.
 * NEVER use this on a mean-separation table: those are intentionally ranked by
 * mean and the ranking is part of the statistical presentation.
 */
export function orderByLevelOrder<T>(items: T[], key: (item: T) => string, order: string[] | undefined): T[] {
  if (!order || order.length === 0) return items;
  const rank = new Map(order.map((level, i) => [level, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.get(key(item)) }))
    .sort((a, b) => {
      const ar = a.r ?? Number.POSITIVE_INFINITY;
      const br = b.r ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return a.i - b.i;
    })
    .map((x) => x.item);
}

/**
 * Index permutation that puts `levels` into `order`, for reordering PARALLEL
 * arrays (levels / means / n) together so a plotted point never detaches from
 * its level. Identity when no order is supplied.
 */
export function levelOrderPermutation(levels: string[], order: string[] | undefined): number[] {
  const indices = levels.map((_, i) => i);
  if (!order || order.length === 0) return indices;
  const rank = new Map(order.map((level, i) => [level, i]));
  return indices.sort((a, b) => {
    const ra = rank.get(levels[a]) ?? Number.POSITIVE_INFINITY;
    const rb = rank.get(levels[b]) ?? Number.POSITIVE_INFINITY;
    return ra !== rb ? ra - rb : a - b;
  });
}

// ── 6. Structured errors ─────────────────────────────────────────────────────

const GENERIC_FAILURE = "The analysis could not be completed. Please check your data and column mapping, then try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValidationEntry(entry: unknown): string | null {
  if (typeof entry === "string") return entry.trim() || null;
  if (!isRecord(entry)) return null;
  const msg = typeof entry.msg === "string" ? entry.msg : typeof entry.message === "string" ? entry.message : null;
  if (!msg) return null;
  const loc = Array.isArray(entry.loc)
    ? entry.loc.filter((part) => part !== "body" && part !== "query").map(String).join(" › ")
    : "";
  return loc ? `${loc}: ${msg}` : msg;
}

/**
 * Turn any backend error body into text a researcher can act on. Never emits
 * raw JSON.
 *
 *  • `detail` string                → the string
 *  • `detail.message`               → the structured message
 *  • `detail` array (422)           → one "field: reason" line per entry
 *  • top-level `message` / `error`  → the message
 */
export function messageFromErrorBody(body: unknown, status?: number): string {
  if (typeof body === "string") {
    const text = body.trim();
    // A string that is itself JSON must not be shown verbatim.
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return messageFromErrorBody(JSON.parse(text), status);
      } catch {
        return GENERIC_FAILURE;
      }
    }
    return text || GENERIC_FAILURE;
  }
  if (!isRecord(body)) return GENERIC_FAILURE;

  const detail = body.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (isRecord(detail)) {
    if (typeof detail.message === "string" && detail.message.trim()) return detail.message.trim();
    if (typeof detail.detail === "string" && detail.detail.trim()) return detail.detail.trim();
  }
  if (Array.isArray(detail)) {
    const lines = detail.map(describeValidationEntry).filter((l): l is string => !!l);
    if (lines.length > 0) {
      return lines.length === 1 ? lines[0] : lines.map((l) => `• ${l}`).join("\n");
    }
  }
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
  if (status === 422) return "Some of the submitted information was not valid. Please check the column mapping and try again.";
  return GENERIC_FAILURE;
}

export interface FailureDisplay {
  heading: string;
  message: string;
  code: string | null;
  /** Authoritative backend text kept for the technical-details area. */
  raw: string;
}

const FAILURE_HEADINGS: Array<[RegExp, string]> = [
  [/non_numeric/, "A response value is not a number"],
  [/missing_cells|missing_and_duplicate|incomplete|duplicate|insufficient|level_lost|missing_whole_plot/, "The design is incomplete"],
  [/missing_structural_identifier|missing_block|missing_treatment/, "A required column is missing or empty"],
];

/**
 * Describe a FAILED trait. `structural_validation.message` is authoritative; the
 * trait's `error` string is only the fallback. The heading follows the stable
 * backend code, so a text-in-numeric refusal is no longer headlined as a
 * "design structure" problem.
 */
export function describeTraitFailure(trait: {
  error?: string | null;
  structural_validation?: { code?: string | null; message?: string | null } | null;
} | null | undefined): FailureDisplay {
  const sv = trait?.structural_validation;
  const code = typeof sv?.code === "string" && sv.code ? sv.code : null;
  const authoritative = typeof sv?.message === "string" ? sv.message.trim() : "";
  const fallback = typeof trait?.error === "string" ? trait.error.trim() : "";
  const message = authoritative || fallback || GENERIC_FAILURE;
  const heading = code
    ? FAILURE_HEADINGS.find(([re]) => re.test(code))?.[1] ?? "The analysis was stopped before fitting"
    : "The analysis was stopped before fitting";
  return { heading, message, code, raw: fallback || authoritative };
}

// ── 7. Release status / maturity ─────────────────────────────────────────────

export interface ReleaseStatusView {
  maturity: "early_access" | "preview" | "unknown";
  /** Badge text. */
  label: string;
  /** Whether a saved run can be reopened later. Drives every Open/Reopen action. */
  reopenable: boolean;
  persistence: string | null;
  /** Backend disclosure text, when supplied. */
  disclosure: string | null;
  source: "backend" | "design_fallback" | "none";
}

const PREVIEW_DESIGNS = new Set(["factorial", "factorial_crd", "factorial_rcbd", "split_plot_rcbd"]);

function viewFor(
  maturity: "early_access" | "preview",
  reopenable: boolean,
  persistence: string | null,
  disclosure: string | null,
  source: ReleaseStatusView["source"],
): ReleaseStatusView {
  const label =
    maturity === "preview"
      ? "Preview · session-only"
      : reopenable
        ? "Early Access · saved runs can be reopened"
        : "Early Access · Word report download";
  return { maturity, label, reopenable, persistence, disclosure, source };
}

/**
 * Resolve the release status to display.
 *
 * The backend's `release_status` wins. Only when it is absent (older payloads,
 * or a history row recorded before this field existed) does the design decide:
 * RCBD → Early Access + reopenable, CRD → Early Access, report download only,
 * Factorial / Split-Plot → Preview, session-only. Unknown designs get no claim.
 */
export function resolveReleaseStatus(raw: unknown, design?: string | null): ReleaseStatusView {
  if (isRecord(raw) && (raw.maturity === "early_access" || raw.maturity === "preview")) {
    const reopenable = raw.maturity === "preview" ? false : raw.reopenable === true;
    return viewFor(
      raw.maturity,
      reopenable,
      typeof raw.persistence === "string" ? raw.persistence : null,
      typeof raw.disclosure === "string" && raw.disclosure.trim() ? raw.disclosure.trim() : null,
      "backend",
    );
  }
  const d = String(design ?? "").trim().toLowerCase();
  if (PREVIEW_DESIGNS.has(d)) return viewFor("preview", false, "session_only", null, "design_fallback");
  if (d === "rcbd") return viewFor("early_access", true, "durable_saved_run", null, "design_fallback");
  if (d === "crd") return viewFor("early_access", false, "report_download_only", null, "design_fallback");
  return { maturity: "unknown", label: "", reopenable: false, persistence: null, disclosure: null, source: "none" };
}

// ── 8. Cook's distance contract ──────────────────────────────────────────────

export interface CooksReview {
  /** Number of observations that crossed the screening threshold; null if not reported. */
  reviewFlagCount: number | null;
  threshold: number | null;
  rule: string | null;
}

/**
 * Read the Cook's-D screening summary, new field names first.
 * Fallbacks (one-release support): n_influential_observations, cooks_threshold /
 * cooks_distance_threshold / threshold.
 */
export function readCooksReview(outlierSummary: unknown): CooksReview {
  const o = isRecord(outlierSummary) ? outlierSummary : {};
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const count =
    num(o.n_cooks_distance_review_flags) ?? num(o.n_influential_observations);
  const threshold =
    num(o.cooks_distance_screening_threshold) ??
    num(o.cooks_distance_threshold) ??
    num(o.cooks_threshold) ??
    num(o.threshold);
  return {
    reviewFlagCount: count,
    threshold,
    rule: typeof o.cooks_distance_screening_rule === "string" ? o.cooks_distance_screening_rule : null,
  };
}

/** Per-observation review flag: `cooks_distance_review_flag`, else legacy `influential`. */
export function cooksReviewFlag(observation: unknown): boolean {
  const o = isRecord(observation) ? observation : {};
  if (typeof o.cooks_distance_review_flag === "boolean") return o.cooks_distance_review_flag;
  return o.influential === true;
}

/**
 * Neutral wording. The 4/n rule is a screening heuristic, so the text never
 * says a point "is influential" — only that it crossed the review threshold.
 */
export function describeCooksReview(review: CooksReview): string | null {
  if (review.reviewFlagCount === null) return null;
  const thr = review.threshold !== null ? ` (${review.threshold.toFixed(3)})` : "";
  if (review.reviewFlagCount === 0) {
    return `No observation crossed the Cook's distance screening threshold${thr}.`;
  }
  const n = review.reviewFlagCount;
  return (
    `${n} observation${n === 1 ? "" : "s"} crossed the Cook's distance screening threshold${thr}. ` +
    "This is a screening heuristic for review, not proof that an observation is influential, and not grounds for removal."
  );
}

// ── 9. CRD blank-response disclosure ─────────────────────────────────────────

export interface ResponseExclusionView {
  lines: { label: string; value: string }[];
  /** Present only when the backend says replication became unequal. */
  unequalReplicationNote: string | null;
}

/** Concise disclosure for the CRD blank-response handling. Absent payload → null. */
export function describeResponseExclusion(raw: unknown): ResponseExclusionView | null {
  if (!isRecord(raw)) return null;
  const lines: { label: string; value: string }[] = [];
  if (typeof raw.original_n === "number") lines.push({ label: "Original N", value: String(raw.original_n) });
  if (typeof raw.effective_n === "number") lines.push({ label: "Analysed N", value: String(raw.effective_n) });

  if (Array.isArray(raw.excluded_rows) && raw.excluded_rows.length > 0) {
    const rows = raw.excluded_rows
      .filter(isRecord)
      .map((r) => {
        const treatment = r.treatment !== undefined && r.treatment !== null ? `treatment ${String(r.treatment)}` : null;
        const reason = typeof r.reason === "string" ? r.reason : null;
        const detail = [treatment, reason].filter(Boolean).join(", ");
        return `row ${String(r.row)}${detail ? ` (${detail})` : ""}`;
      });
    if (rows.length > 0) lines.push({ label: "Excluded", value: rows.join("; ") });
  }

  if (isRecord(raw.treatment_n)) {
    const entries = Object.entries(raw.treatment_n).map(([k, v]) => `${k} = ${String(v)}`);
    if (entries.length > 0) lines.push({ label: "Observations per treatment", value: entries.join(", ") });
  }

  if (lines.length === 0) return null;
  return {
    lines,
    unequalReplicationNote:
      raw.unequal_replication === true
        ? "Replication is now unequal; treatment means and comparisons use each treatment's own n."
        : null,
  };
}

// ── 10. History: de-duplication and publication-ready counting ───────────────

const RUN_ID_KEY = "persistence_analysis_run_id";

function runIdOf(row: { analysis_parameters?: Record<string, unknown> | null }): string | null {
  const v = row.analysis_parameters?.[RUN_ID_KEY];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Keep one history entry per durable `analysis_run_id`, so a RECOVERED_COMPLETE
 * re-record of the same run is not listed twice. Rows with no run id are never
 * merged. Input order is preserved; the first occurrence wins.
 */
export function dedupeHistoryByRunId<T extends { analysis_parameters?: Record<string, unknown> | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = runIdOf(row);
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(row);
  }
  return out;
}

/** Release status of a stored history row: recorded status first, then its design. */
export function historyReleaseStatus(row: {
  design_type?: string | null;
  analysis_parameters?: Record<string, unknown> | null;
}): ReleaseStatusView {
  return resolveReleaseStatus(row.analysis_parameters?.release_status, row.design_type);
}

/**
 * Whether a history row may offer an Open / Reopen action.
 *
 * Driven by `reopenable`: a Preview (session-only) or CRD (report-download-only)
 * analysis cannot be reopened, so no action is offered that would imply it can.
 * Rows of unknown maturity (non-ANOVA modules) keep their existing "Open", which
 * only navigates to the module.
 */
export function canOpenHistoryRow(row: {
  design_type?: string | null;
  analysis_parameters?: Record<string, unknown> | null;
}): boolean {
  const release = historyReleaseStatus(row);
  if (release.maturity === "unknown") return true;
  return release.reopenable;
}

/**
 * "Publication-ready" count. Successful analyses only, and never a Preview
 * (session-only) analysis. Analyses of unknown maturity (non-ANOVA modules) keep
 * their existing behaviour and still count.
 */
export function countPublicationReady(
  rows: Array<{
    analysis_status?: string | null;
    design_type?: string | null;
    analysis_parameters?: Record<string, unknown> | null;
  }>,
): { publicationReady: number; preview: number; notSuccessful: number } {
  let publicationReady = 0;
  let preview = 0;
  let notSuccessful = 0;
  for (const row of rows) {
    if (row.analysis_status !== "success") {
      notSuccessful += 1;
      continue;
    }
    if (historyReleaseStatus(row).maturity === "preview") preview += 1;
    else publicationReady += 1;
  }
  return { publicationReady, preview, notSuccessful };
}

// ── 11. Mapping-warning wording ──────────────────────────────────────────────

const TOGGLE_WARNING = /toggle it to treatment factor/i;

/**
 * The backend upload-preview appends a generic hint telling users to "toggle it
 * to Treatment Factor". This interface has no such toggle. Replace that hint
 * with guidance that names a control that actually exists. Other warnings pass
 * through untouched.
 */
export function rewriteMappingWarning(warning: string): string {
  if (TOGGLE_WARNING.test(warning)) {
    return (
      "If a column holds numeric treatment levels (for example 0, 50, 100 kg N/ha or storage days 1, 3, 6, 9), " +
      "choose it in the “Treatment / Factor Column” selector below."
    );
  }
  return warning;
}

/**
 * Trigger label for the collapsible detail panel. It names what that panel
 * actually contains, not what the analysis page as a whole presents: Factorial
 * and Split-Plot callers render their mean separation elsewhere and pass none
 * here, so their panel holds the ANOVA table only.
 */
export function detailedStatsLabel(opts: {
  domainNeutral?: boolean;
  hasAnova: boolean;
  hasMeanSeparation: boolean;
}): string {
  if (!opts.domainNeutral) return "Show Detailed Statistics";
  if (opts.hasAnova && opts.hasMeanSeparation) return "View ANOVA Table & Mean Separation";
  if (opts.hasAnova) return "View ANOVA Table";
  if (opts.hasMeanSeparation) return "View Mean Separation";
  return "View Detailed Statistics";
}
