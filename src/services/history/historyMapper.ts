/**
 * Research Analysis History — pure mapping helpers (Phase 1).
 *
 * Turns a RecordAnalysisInput (+ identity/profile snapshot) into a DB row.
 * Only values actually present are stored — nothing is inferred or fabricated.
 */

import type {
  AnalysisTypeId,
  NewAnalysisHistoryRow,
  ProfileSnapshot,
  RecordAnalysisInput,
} from "./historyTypes";

const TYPE_LABEL: Record<AnalysisTypeId, string> = {
  anova: "ANOVA",
  genetic_parameters: "Genetic Parameters",
  correlation: "Correlation",
  regression: "Regression",
  pca: "PCA",
  cluster: "Cluster Analysis",
  blup: "BLUP",
  stability: "Stability",
  path_analysis: "Path Analysis",
  selection_index: "Selection Index",
};

/** Human-readable label for an analysis type (falls back to the raw id). */
export function analysisLabel(type: AnalysisTypeId | string): string {
  return (TYPE_LABEL as Record<string, string>)[type] ?? type;
}

/** Derive a friendly title, e.g. "ANOVA · maize.csv". */
export function deriveTitle(input: RecordAnalysisInput): string {
  if (input.title) return input.title;
  const label = analysisLabel(input.analysisType);
  return input.datasetName ? `${label} · ${input.datasetName}` : label;
}

/**
 * Extract a compact result_summary from a raw backend response. Defensive —
 * unknown shapes simply yield fewer keys. Never stores the full response.
 */
export function deriveResultSummary(input: RecordAnalysisInput): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  if (input.traits?.length) summary.n_traits = input.traits.length;

  const r = input.response as Record<string, unknown> | undefined;
  if (r && typeof r === "object") {
    const ds = r.dataset_summary as Record<string, unknown> | undefined;
    if (ds && typeof ds === "object") {
      for (const k of ["n_genotypes", "n_reps", "n_environments", "n_traits", "mode"] as const) {
        if (ds[k] != null) summary[k] = ds[k];
      }
    }
    if (Array.isArray(r.failed_traits)) summary.failed_traits = r.failed_traits.length;
    if (r.trait_results && typeof r.trait_results === "object") {
      summary.traits_analyzed = Object.keys(r.trait_results as object).length;
    }
  }
  return summary;
}

/** Build the insert-ready row from input + identity + profile snapshot. */
export function buildHistoryRow(
  input: RecordAnalysisInput,
  userId: string,
  profile: ProfileSnapshot,
  frontendVersion: string,
): NewAnalysisHistoryRow {
  const executionMs =
    input.startedAt != null
      ? Math.max(0, Math.round(performance.now() - input.startedAt))
      : null;

  return {
    user_id: userId,
    session_id: input.sessionId ?? null,
    analysis_type: input.analysisType,
    analysis_title: deriveTitle(input),
    study_name: input.studyName ?? null,
    design_type: input.designType ?? null,
    dataset_name: input.datasetName ?? null,
    dataset_token: input.datasetToken ?? null,
    traits: input.traits ?? null,
    analysis_status: "success",
    execution_time_ms: executionMs,
    backend_endpoint: input.backendEndpoint,
    backend_version: null, // only if the backend returns one; never inferred
    frontend_version: frontendVersion,
    institution: profile.institution,
    country: profile.country,
    user_role: profile.user_role,
    analysis_parameters: input.parameters ?? {},
    result_summary: deriveResultSummary(input),
    notes: null,
    favorite: false,
  };
}
