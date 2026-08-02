/**
 * Module-adaptive metrics for the Workspace V3 "Recent Analyses" cards.
 *
 * A card renders ONLY the fields whose key is actually present (non-null) in
 * that analysis row's `result_summary`. Nothing is fabricated: if the backend/
 * recording path never stored a value, the field is silently omitted.
 *
 * Today `deriveResultSummary` (services/history/historyMapper.ts) persists only
 * dataset dimensions (n_genotypes, n_reps, n_environments, n_traits, mode). The
 * statistical headline fields below (f_value, p_value, cv, r_squared, …) are
 * declared FIRST so that, once the recording path is extended to persist them
 * (a separate, flagged change — it must be verified against each module's real
 * response shape), they light up automatically with no UI change.
 *
 * Extend one module = add one entry here. No per-module conditional JSX.
 */
import type { AnalysisTypeId } from "@/services/history/historyTypes";

export interface MetricField {
  /** Key looked up in result_summary. */
  key: string;
  label: string;
  /** Render in the monospace numeric style. Default true. */
  mono?: boolean;
  /** Optional formatter; receives the raw stored value. */
  format?: (v: unknown) => string;
}

// ── shared formatters ────────────────────────────────────────────────────────
const num = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? String(n) : String(v ?? "—");
};
const pval = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? "—");
  return n < 0.001 ? "< 0.001" : n.toFixed(3);
};
const fixed = (d: number) => (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : String(v ?? "—");
};
const pct = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(v ?? "—");
};

/** Dataset-dimension fields available on essentially every row today. */
const DATASET_DIMS: MetricField[] = [
  { key: "n_genotypes", label: "Genotypes", format: num },
  { key: "n_reps", label: "Reps", format: num },
  { key: "n_environments", label: "Environments", format: num },
  { key: "traits_analyzed", label: "Traits", format: num },
  { key: "n_traits", label: "Traits", format: num },
  { key: "n_observations", label: "Obs.", format: num },
];

/**
 * Per-module field order. Statistical headline fields lead (populate later),
 * dataset dimensions trail (populate today). The renderer filters to whatever
 * is present and caps the count, so leading-but-absent fields cost nothing.
 */
export const METRICS_CONFIG: Partial<Record<AnalysisTypeId | string, MetricField[]>> = {
  anova: [
    { key: "f_value", label: "F-value", format: fixed(2) },
    { key: "p_value", label: "P-value", format: pval },
    { key: "cv", label: "CV", format: pct },
    { key: "r_squared", label: "R²", format: fixed(2) },
    { key: "best_entry", label: "Best entry", mono: false },
    ...DATASET_DIMS,
  ],
  genetic_parameters: [
    { key: "h2", label: "H²", format: fixed(2) },
    { key: "gcv", label: "GCV", format: pct },
    { key: "pcv", label: "PCV", format: pct },
    { key: "gam_percent", label: "GAM", format: pct },
    ...DATASET_DIMS,
  ],
  correlation: [
    // 2-trait pairwise case only — the backend provides these as scalars.
    // Multi-trait "highest r" is intentionally absent (would need client argmax).
    { key: "pair_r", label: "r", format: fixed(2) },
    { key: "pair_p", label: "P-value", format: pval },
    ...DATASET_DIMS,
  ],
  pca: [
    { key: "pc1_variance", label: "PC1", format: pct },
    { key: "pc2_variance", label: "PC2", format: pct },
    { key: "cumulative_variance", label: "Cumulative", format: pct },
    { key: "key_loader", label: "Key loader", mono: false },
    ...DATASET_DIMS,
  ],
  cluster: [
    { key: "optimal_k", label: "Clusters (k)", format: num },
    ...DATASET_DIMS,
  ],
  regression: [
    { key: "r_squared", label: "R²", format: fixed(2) },
    { key: "adjusted_r_squared", label: "Adj R²", format: fixed(2) },
    { key: "p_value_slope", label: "P-value", format: pval },
    { key: "slope", label: "Slope", format: fixed(3) },
    ...DATASET_DIMS,
  ],
};

/** Module tag accent (mockup palette). Falls back to the brand/primary accent. */
export type MetricAccent = "primary" | "blue" | "purple" | "amber";
export const MODULE_ACCENT: Record<string, MetricAccent> = {
  anova: "primary",
  genetic_parameters: "primary",
  correlation: "blue",
  trait_association: "blue",
  path_analysis: "blue",
  regression: "blue",
  pca: "purple",
  cluster: "purple",
  blup: "purple",
  stability: "purple",
  selection_index: "purple",
};

export interface ResolvedMetric {
  label: string;
  value: string;
  mono: boolean;
}

/**
 * Resolve the metrics to display for one analysis row: the module's configured
 * fields, filtered to those actually present in result_summary, de-duplicated
 * by label, capped at `max`.
 */
export function resolveMetrics(
  analysisType: string,
  resultSummary: Record<string, unknown> | null | undefined,
  max = 5,
): ResolvedMetric[] {
  const fields = METRICS_CONFIG[analysisType] ?? DATASET_DIMS;
  const rs = resultSummary ?? {};
  const out: ResolvedMetric[] = [];
  const seenLabel = new Set<string>();
  for (const f of fields) {
    if (seenLabel.has(f.label)) continue;
    const raw = rs[f.key];
    if (raw === undefined || raw === null || raw === "") continue;
    out.push({
      label: f.label,
      value: f.format ? f.format(raw) : String(raw),
      mono: f.mono !== false,
    });
    seenLabel.add(f.label);
    if (out.length >= max) break;
  }
  return out;
}
