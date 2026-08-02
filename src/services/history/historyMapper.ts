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
  trait_association: "Trait Association",
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

// ── extraction helpers ───────────────────────────────────────────────────────
const asObj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
const finiteNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
/** Normalise a variance value to a percentage. Backend returns either a
 *  proportion (0–1) or an already-scaled percent; mirror the panels' heuristic. */
const toPct = (v: unknown): number | undefined => {
  const n = finiteNum(v);
  if (n === undefined) return undefined;
  return n <= 1 ? n * 100 : n;
};
const setIf = (o: Record<string, unknown>, key: string, v: number | undefined) => {
  if (v !== undefined) o[key] = v;
};

/**
 * Persist per-module HEADLINE metrics — only values the backend actually returns,
 * verified against each module's real response type. Ambiguous cases are skipped,
 * never guessed (a wrong key would surface a fabricated statistic). Multi-trait
 * ANOVA / genetic-parameters have no single headline, so those metrics are stored
 * only when exactly one trait was analysed. See lib/workspace/metricsConfig.ts.
 */
function extractHeadlineMetrics(
  type: string,
  r: Record<string, unknown>,
  summary: Record<string, unknown>,
): void {
  if (type === "pca") {
    const ve = Array.isArray(r.variance_explained) ? (r.variance_explained as unknown[]) : undefined;
    const cum = Array.isArray(r.cumulative_variance) ? (r.cumulative_variance as unknown[]) : undefined;
    setIf(summary, "pc1_variance", toPct(ve?.[0]));
    setIf(summary, "pc2_variance", toPct(ve?.[1]));
    setIf(summary, "cumulative_variance", toPct(cum?.[1] ?? (cum ? cum[cum.length - 1] : undefined)));
    return;
  }

  if (type === "cluster") {
    setIf(summary, "optimal_k", finiteNum(r.optimal_k));
    return;
  }

  if (type === "anova") {
    // Single-trait only — a single F/p is meaningless across multiple traits.
    const traitResults = asObj(r.trait_results);
    const keys = traitResults ? Object.keys(traitResults) : [];
    if (keys.length !== 1) return;
    const result = asObj(asObj(asObj(traitResults![keys[0]])?.analysis_result)?.result);
    const at = asObj(result?.anova_table);
    const source = Array.isArray(at?.source) ? (at!.source as unknown[]) : undefined;
    if (!source) return;
    const idx = source.findIndex(
      (s) => typeof s === "string" && ["genotype", "treatment"].includes(s.toLowerCase()),
    );
    if (idx < 0) return;
    const fv = Array.isArray(at!.f_value) ? (at!.f_value as unknown[]) : undefined;
    const pv = Array.isArray(at!.p_value) ? (at!.p_value as unknown[]) : undefined;
    setIf(summary, "f_value", finiteNum(fv?.[idx]));
    setIf(summary, "p_value", finiteNum(pv?.[idx]));
    return;
  }

  if (type === "genetic_parameters") {
    const traitResults = asObj(r.trait_results);
    const keys = traitResults ? Object.keys(traitResults) : [];
    if (keys.length !== 1) return;
    const t = asObj(traitResults![keys[0]]);
    if (!t) return;
    setIf(summary, "h2", finiteNum(asObj(t.heritability)?.h2_broad_sense));
    setIf(summary, "gcv", finiteNum(t.gcv));
    setIf(summary, "pcv", finiteNum(t.pcv));
    setIf(summary, "gam_percent", finiteNum(t.gam));
    return;
  }

  if (type === "regression") {
    // RegressionResponse is flat; keys verified against the backend Pydantic
    // model (analysis_regression_routes.py: RegressionResponse). Note the slope
    // p-value key is `p_value_slope`, not `p_value`.
    setIf(summary, "r_squared", finiteNum(r.r_squared));
    setIf(summary, "adjusted_r_squared", finiteNum(r.adjusted_r_squared));
    setIf(summary, "p_value_slope", finiteNum(r.p_value_slope));
    setIf(summary, "slope", finiteNum(r.slope));
    return;
  }

  if (type === "correlation") {
    // Multi-trait correlation returns only r_matrix/p_matrix — a single "highest
    // r" would require argmax (a client-side computation), so it is NOT derived.
    // The 2-trait pairwise case exposes phenotypic.r / phenotypic.p_value as
    // direct backend scalars — those are safe to surface.
    const ph = asObj(r.phenotypic);
    setIf(summary, "pair_r", finiteNum(ph?.r));
    setIf(summary, "pair_p", finiteNum(ph?.p_value));
    return;
  }
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
    // Advanced-analysis responses carry dataset dims at the top level, not nested.
    for (const k of ["n_genotypes", "n_environments", "n_observations"] as const) {
      if (summary[k] == null && r[k] != null) summary[k] = r[k];
    }
    if (Array.isArray(r.failed_traits)) summary.failed_traits = r.failed_traits.length;
    if (r.trait_results && typeof r.trait_results === "object") {
      summary.traits_analyzed = Object.keys(r.trait_results as object).length;
    }

    // Per-module headline metrics (verified extractions only).
    extractHeadlineMetrics(input.analysisType, r, summary);
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
