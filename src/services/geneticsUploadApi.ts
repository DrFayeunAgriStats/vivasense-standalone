/**
 * VivaSense Genetics Upload API Client
 * =====================================
 * Calls the two multi-trait upload endpoints:
 *   POST /genetics/upload-preview   – file preview + column detection
 *   POST /genetics/analyze-upload   – trait-by-trait analysis
 *
 * In Lovable/Vercel environment variables, set:
 *   VITE_API_URL = https://vivasense-genetics-docker.onrender.com
 */

import { API_BASE } from "./apiConfig";
import { buildModeHeaders, guardProModule } from "./featureMode";
import { requestWithResilience } from "./httpClient";
const ENGINE_BASE: string = API_BASE;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectedColumn {
  column: string;
  confidence: "high" | "medium" | "low";
}

export interface DetectedColumns {
  genotype: DetectedColumn | null;
  rep: DetectedColumn | null;
  environment: DetectedColumn | null;
  traits: string[];
}

export interface UploadPreviewResponse {
  detected_columns: DetectedColumns;
  n_rows: number;
  n_columns: number;
  data_preview: Record<string, unknown>[];
  mode_suggestion: "single" | "multi";
  column_names: string[];
  warnings: string[];
  /** Dataset token registered at preview time using auto-detected columns.
   *  Issued by POST /genetics/upload-preview; pass to stateful /analysis/* endpoints. */
  dataset_token?: string | null;
}

/**
 * Inferential alpha accepted by the governed backend.
 * Mirrors `alpha: Literal[0.01, 0.05, 0.10]` in multitrait_upload_schemas.py.
 * (0.10 and 0.1 are the same numeric literal in both languages.)
 */
export type AnovaAlpha = 0.01 | 0.05 | 0.1;

/**
 * Design identifiers understood by the frozen ANOVA v1 backend.
 *
 * `factorial` is the LEGACY identifier this client sent before the backend
 * separated factorial CRD from factorial RCBD. It is retained purely for
 * backward compatibility with stored history entries and in-flight callers;
 * new code should send `factorial_crd` or `factorial_rcbd`, because only those
 * reach the governed two-factor path (a blockless factorial sent as `factorial`
 * is not analysed as A*B).
 */
export type GovernedDesignType =
  | "crd"
  | "rcbd"
  | "factorial_crd"
  | "factorial_rcbd"
  | "split_plot_rcbd";

export type AnovaDesignTypeWire = GovernedDesignType | "factorial";

export interface UploadAnalysisRequest {
  base64_content: string;
  file_type: "csv" | "xlsx" | "xls";
  genotype_column: string;
  rep_column: string;
  environment_column: string | null;
  /**
   * Ordered columns whose interaction defines the environment, e.g.
   * ["Location", "Year"]. Applied by the backend ONLY when
   * environment_column is absent — an explicit environment column always wins.
   */
  environment_factor_columns?: string[];
  numeric_factor_columns?: string[];
  trait_columns: string[];
  mode: "single" | "multi";
  random_environment?: boolean;
  selection_intensity: number;
  module?: "anova" | "genetic_parameters" | "correlation" | "heatmap";
  research_domain?: "plant_breeding" | "agronomy" | "general";
  /**
   * Selected inferential alpha. Omitted requests fall back to the backend
   * default of 0.05, which is the behaviour every current caller relies on —
   * Phase A only makes the field representable, it does not start sending it.
   */
  alpha?: AnovaAlpha;
  // Optional ANOVA-specific routing hints.
  design_type?: AnovaDesignTypeWire;
  treatment_column?: string;
  factor_a_column?: string;
  factor_b_column?: string;
  factor_c_column?: string;
  main_plot_column?: string;
  sub_plot_column?: string;
}

export interface SummaryTableRow {
  trait: string;
  grand_mean?: number;
  h2?: number;
  gcv?: number;
  pcv?: number;
  gam_percent?: number;
  heritability_class?: "high" | "moderate" | "low";
  gam_class?: "High" | "Medium" | "Low";
  status: "success" | "failed";
  error?: string;
}

export interface DatasetSummary {
  n_genotypes: number;
  n_reps: number;
  n_environments?: number;
  n_traits: number;
  mode: string;
}

// ── Nested types that mirror GeneticsResult / GeneticsResponse in app_genetics.py ──

export interface AnovaTable {
  source: string[];
  df: number[];
  ss: (number | null)[];
  ms: (number | null)[];
  f_value: (number | null)[];
  p_value: (number | null)[];
}

export interface MeanSeparation {
  genotype: string[];
  mean: number[];
  se: (number | null)[];
  group: string[];
  test: string;
  alpha: number;
  /** Actual column name for factorial / split-plot designs. */
  treatment_label?: string | null;
  /**
   * What the reported means ARE, stated rather than inferred — factorial v1
   * sets "Marginal arithmetic mean" so a marginal mean is never mistaken for
   * an estimated marginal / LS-mean, which v1 does not compute.
   */
  scale_label?: string | null;
}

// ── Governed ANOVA v1 contract ───────────────────────────────────────────────
// These mirror genetics_schemas.py exactly. Every field is optional: a response
// from an older backend, or from a design that does not populate a given block,
// simply omits it and existing rendering is unaffected.

/**
 * An omnibus decision taken at the SELECTED inferential alpha.
 *
 * Split-plot decisions additionally name the error stratum that produced them
 * and that stratum's df/MS, which is what makes "A was tested against Error A"
 * checkable rather than asserted.
 */
export interface GovernedDecision {
  estimable?: boolean;
  significant?: boolean;
  p_value?: number | null;
  alpha?: number;
  rule?: string;
  error_stratum?: string;
  denominator_df?: number | null;
  denominator_ms?: number | null;
  [key: string]: unknown;
}

/** Authoritative one-factor CRD / complete-RCBD omnibus decision. */
export interface TreatmentDecision extends GovernedDecision {
  estimable: boolean;
  significant: boolean;
  p_value?: number | null;
  alpha: number;
  inferential_alpha?: number;
  diagnostic_alpha?: number;
}

/**
 * Why a post-hoc family did, or did not, produce grouping letters.
 * `status: "not_run_omnibus_not_significant"` is a governed outcome, not a
 * failure — the gate is reporting that it stayed shut.
 */
export interface MeanSeparationStatus {
  status: string;
  method?: string;
  alpha?: number;
  omnibus_p_value?: number | null;
  reason_code?: string | null;
  message?: string;
  residual_df?: number | null;
  residual_ms?: number | null;
  means_provenance?: string | null;
  error_stratum?: string;
  [key: string]: unknown;
}

/** Design identity, factor names/levels, model formula, SS provenance. */
export type FactorialProfile = Record<string, unknown>;
/** Blocks, whole/sub plots, replication, observation counts, denominator map. */
export type SplitPlotProfile = Record<string, unknown>;
/** Descriptive cell means backing the interaction plot. */
export type InteractionMeansPayload = Record<string, unknown>;
/** { moving_a_within_b: [...], moving_b_within_a: [...] } */
export type SimpleEffects = Record<string, unknown>;

/** Effective inferential + fixed diagnostic alpha provenance. */
export interface AnalysisSettings {
  inferential_alpha?: number;
  diagnostic_alpha?: number;
  [key: string]: unknown;
}

export interface GeneticsResult {
  environment_mode: string;
  n_genotypes: number;
  n_reps: number;
  n_environments: number | null;
  grand_mean: number;
  variance_components: Record<string, number | null>;
  heritability: {
    h2_broad_sense: number;
    interpretation_basis: string;
    formula?: string;
  };
  genetic_parameters: {
    GCV?: number;
    PCV?: number;
    GAM?: number;
    GAM_percent?: number;
    selection_intensity: number;
  };
  anova_table?: AnovaTable;
  mean_separation?: MeanSeparation;

  // ── Governed ANOVA v1 payload (all optional; absent on older responses) ────

  /** Engine design label: crd | rcbd | factorial_crd | factorial_rcbd | split_plot_rcbd. */
  design?: string | null;
  n_treatment_factors?: number | null;

  // CRD / RCBD
  treatment_decision?: TreatmentDecision | null;
  mean_separation_status?: MeanSeparationStatus | null;
  observation_accounting?: Record<string, unknown> | null;
  experimental_unit_profile?: Record<string, unknown> | null;
  rcbd_design_profile?: Record<string, unknown> | null;
  diagnostic_policy?: Record<string, unknown> | null;

  // Factorial v1
  factorial_profile?: FactorialProfile | null;
  factor_a_decision?: GovernedDecision | null;
  factor_b_decision?: GovernedDecision | null;
  interaction_decision?: GovernedDecision | null;
  factor_a_mean_separation_status?: MeanSeparationStatus | null;
  factor_b_mean_separation_status?: MeanSeparationStatus | null;
  simple_effects?: SimpleEffects | null;
  simple_effects_status?: Record<string, unknown> | null;
  interaction_plot?: Record<string, unknown> | null;
  mean_separation_b?: MeanSeparation | null;
  interaction_separation?: InteractionMeansPayload | null;

  // Three-factor factorial — LIMITED / EXPERIMENTAL, typed so it is not
  // silently dropped, deliberately not promoted in the UI.
  mean_separation_c?: MeanSeparation | null;
  mean_separation_basis?: Record<string, unknown> | null;
  two_way_interaction_means?: Record<string, unknown> | null;

  // Split-Plot v1
  split_plot_profile?: SplitPlotProfile | null;
  whole_plot_decision?: GovernedDecision | null;
  sub_plot_decision?: GovernedDecision | null;
  split_plot_interaction_decision?: GovernedDecision | null;
  main_plot_separation_status?: MeanSeparationStatus | null;
  sub_plot_separation_status?: MeanSeparationStatus | null;
  main_plot_mean_separation?: MeanSeparation | null;
  /** Split-plot A×B cell means backing the interaction plot (descriptive). */
  interaction_means?: InteractionMeansPayload | null;
}

export interface GeneticsResponse {
  status: string;
  mode: string;
  data_validation: Record<string, unknown>;
  variance_warnings: Record<string, unknown>;
  result: GeneticsResult | null;
  interpretation: string | null;
  anova_type_warning?: string | null;
}

/** Matches TraitResult in multitrait_upload_schemas.py */
export interface TraitResult {
  status: "success" | "failed";
  analysis_result: GeneticsResponse | null; // null when status === "failed"
  error: string | null;
  data_warnings: string[];
}

export interface UploadAnalysisResponse {
  summary_table: SummaryTableRow[];
  trait_results: Record<string, TraitResult>;
  dataset_summary: DatasetSummary;
  failed_traits: string[];
  anova_type_warning?: string | null;
  domain?: "plant_breeding" | "agronomy" | "general";
  /**
   * Opaque token the backend stores alongside the full analysis result.
   * It MUST be echoed back verbatim to POST /genetics/download-results so the
   * export can recover result objects the frontend never serialised. Dropping
   * it is why a hand-assembled export payload cannot satisfy exact-token
   * identity — the backend answers 409 rather than substituting a report.
   */
  export_token?: string | null;
  dataset_token?: string | null;
  /** Effective inferential and fixed diagnostic alpha provenance. */
  analysis_settings?: AnalysisSettings;
  module?: string | null;
  breeding_summary?: string | null;
  evidence_level?: string;
  experimental_structure?: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a CSV/Excel file and get column detection + data preview.
 * No analysis is run — this is a fast pre-flight call.
 */
export async function previewUpload(file: File): Promise<UploadPreviewResponse> {
  const fd = new FormData();
  fd.append("file", file);

  const previewUrl = `${ENGINE_BASE}/genetics/upload-preview`;
  console.log("[geneticsUploadApi] POST", previewUrl);

  let response: Response;
  try {
    response = await requestWithResilience(previewUrl, {
      method: "POST",
      headers: buildModeHeaders(),
      body: fd,
      timeoutMs: 60000,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Network error reaching genetics engine: ${msg}. ` +
        "Verify VITE_API_URL is set correctly."
    );
  }

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    throw new Error(`Preview failed — ${detail}`);
  }

  return response.json() as Promise<UploadPreviewResponse>;
}

/**
 * Analyze all selected traits in a previously-uploaded file.
 * The file content is passed as base64 (avoids re-uploading).
 * One trait failing does not stop the others.
 */
export async function analyzeUpload(
  request: UploadAnalysisRequest
): Promise<UploadAnalysisResponse> {
  const selectedModule = request.module ?? "genetic_parameters";
  const hasEnvironmentFactor = (request.environment_column ?? "").trim().length > 0;
  const isCombinedAnova = selectedModule === "anova" && (request.mode === "multi" || hasEnvironmentFactor);

  if (selectedModule === "genetic_parameters") {
    guardProModule("genetic-parameters");
  } else if (isCombinedAnova) {
    guardProModule("combined-anova");
  }

  // Temporary debug log — remove after integration is confirmed working.
  console.log("[analyzeUpload] request fields:", {
    file_type: request.file_type,
    genotype_column: request.genotype_column,
    rep_column: request.rep_column,
    environment_column: request.environment_column,
    trait_columns: request.trait_columns,
    mode: request.mode,
    random_environment: request.random_environment,
    selection_intensity: request.selection_intensity,
    base64_content: request.base64_content
      ? `[base64, ${request.base64_content.length} chars]`
      : "(empty — file encoding failed)",
  });

  const analyzeUrl = `${ENGINE_BASE}/genetics/analyze-upload${request.module ? `?module=${encodeURIComponent(request.module)}` : ""}`;
  console.log("[geneticsUploadApi] POST", analyzeUrl);

  let response: Response;
  try {
    response = await requestWithResilience(analyzeUrl, {
      method: "POST",
      headers: buildModeHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(request),
      timeoutMs: 180000,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error during analysis: ${msg}`);
  }

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    throw new Error(`Analysis failed — ${detail}`);
  }

  const data = (await response.json()) as UploadAnalysisResponse;

  // Debug: log anova_table + mean_separation presence for each trait
  for (const [trait, tr] of Object.entries(data.trait_results ?? {})) {
    const result = tr.analysis_result?.result;
    console.log(`[analyzeUpload] trait="${trait}" status=${tr.status}`, {
      has_anova_table: result?.anova_table != null,
      anova_sources: result?.anova_table?.source,
      has_mean_separation: result?.mean_separation != null,
      mean_sep_genotypes: result?.mean_separation?.genotype,
      mean_sep_groups: result?.mean_separation?.group,
    });
  }

  return data;
}

/**
 * Build the governed export payload for POST /genetics/download-results.
 *
 * The governed backend renders its report from the FULL analysis response and
 * recovers anything the client did not serialise via `export_token`. A payload
 * assembled field-by-field therefore cannot produce a governed report: the
 * decision objects, profiles and separation statuses are simply absent, and
 * without the token the backend refuses to substitute (HTTP 409) rather than
 * export a report belonging to a different analysis.
 *
 * Phase A adds this builder only. The live ANOVA download still uses its
 * existing hand-assembled payload; switching it over is Phase C, because that
 * switch changes the produced document and so is a visible-behaviour change.
 */
export function buildGovernedExportPayload(
  data: UploadAnalysisResponse,
  options: { module?: string; domain?: "plant_breeding" | "agronomy" | "general" } = {}
): Record<string, unknown> {
  // Same normalisation exportWordReport applies: every entry needs "status".
  const normalizedTraitResults: Record<string, TraitResult> = {};
  for (const [trait, tr] of Object.entries(data.trait_results ?? {})) {
    normalizedTraitResults[trait] = {
      status: tr.status ?? (tr.analysis_result != null ? "success" : "failed"),
      analysis_result: tr.analysis_result,
      error: tr.error,
      data_warnings: tr.data_warnings ?? [],
    };
  }
  return {
    ...data,
    trait_results: normalizedTraitResults,
    anova_type_warning: data.anova_type_warning ?? null,
    module: options.module ?? data.module ?? "anova",
    domain: options.domain ?? data.domain ?? "plant_breeding",
    // Echoed verbatim — never regenerated, never defaulted.
    export_token: data.export_token ?? null,
  };
}

/**
 * Generate and download a Word (.docx) report from completed analysis results.
 * Endpoint: POST /genetics/download-results  (alias: /genetics/export-word)
 *
 * The function triggers a browser file download directly — no return value.
 */
export async function exportWordReport(
  data: UploadAnalysisResponse,
  filename = "vivasense_genetics_report.docx",
  domain?: "plant_breeding" | "agronomy" | "general"
): Promise<void> {
  guardProModule("export-word");
  // Normalise trait_results so every entry has the required "status" field.
  // Guards against state where status was dropped during result construction.
  const normalizedTraitResults: Record<string, TraitResult> = {};
  for (const [trait, tr] of Object.entries(data.trait_results)) {
    normalizedTraitResults[trait] = {
      status: tr.status ?? (tr.analysis_result != null ? "success" : "failed"),
      analysis_result: tr.analysis_result,
      error: tr.error,
      data_warnings: tr.data_warnings ?? [],
    };
  }
  const payload: UploadAnalysisResponse = {
    ...data,
    trait_results: normalizedTraitResults,
    anova_type_warning: data.anova_type_warning ?? null,
    domain: domain ?? data.domain ?? "plant_breeding",
  };

  console.log("[exportWordReport] Download payload:", JSON.stringify(payload, null, 2));

  const exportUrl = `${ENGINE_BASE}/genetics/download-results`;
  console.log("[geneticsUploadApi] POST", exportUrl);

  let response: Response;
  try {
    response = await requestWithResilience(exportUrl, {
      method: "POST",
      headers: buildModeHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      timeoutMs: 180000,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error during Word export: ${msg}`);
  }

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    console.error("[exportWordReport] Server error", response.status, msg);
    throw new Error(`Word export failed (${response.status}) — ${msg}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    return JSON.stringify(body.detail ?? body);
  } catch {
    try {
      return await response.text();
    } catch {
      return `HTTP ${response.status} ${response.statusText}`;
    }
  }
}

/** Convert a File to base64 string (for analyzeUpload). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:...;base64," prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATASET CONTEXT
// Shared from the Upload File tab → Trait Relationships tab.
// MultiTraitUpload emits this once the user confirms column mapping.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot of a confirmed upload session.
 * Passed from MultiTraitUpload (via onDatasetReady) up to DataSourceTabs,
 * then down into TraitRelationships and DescriptiveStatsModule.
 */
export interface UploadDatasetContext {
  /** The original File object (kept for display purposes). */
  file: File;
  /** Pre-computed base64 string — avoids re-encoding when running correlation. */
  base64Content: string;
  fileType: "csv" | "xlsx" | "xls";
  genotypeColumn: string;
  repColumn: string;
  /** Defined only when mode === "multi". */
  environmentColumn?: string;
  /** All numeric columns detected in the file (not just the ones selected for heritability). */
  availableTraitColumns: string[];
  mode: "single" | "multi";
  /**
   * Token issued by POST /genetics/upload-preview. Required by stateful
   * /analysis/* module endpoints. Null if none was issued.
   */
  datasetToken: string | null;
  /** User-selected research domain — drives terminology throughout the UI and backend interpretation. */
  research_domain?: "plant_breeding" | "agronomy" | "general";
  /** All column names from the uploaded file (used by downstream selectors). */
  columns?: string[];
  /** Alias of `columns` — convenience for components that prefer this name. */
  availableColumns?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIPTIVE STATISTICS  (POST /analysis/descriptive-stats)
// ─────────────────────────────────────────────────────────────────────────────

export interface TraitDescriptiveResult {
  trait: string;
  n: number;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
  sd: number | null;
  cv_percent: number | null;
  median: number | null;
  skewness: number | null;
  kurtosis: number | null;
  missing_count: number;
  zero_count: number;
  precision_class: string;
  flags: string[];
  interpretation: string;
}

export interface DescriptiveStatsResponse {
  dataset_token: string;
  overview: { n_traits: number; n_observations: number };
  summary_table: TraitDescriptiveResult[];
  reliable_traits: string[];
  caution_traits: string[];
  global_flags: string[];
  recommendation: string;
}

/**
 * Export descriptive statistics results as a Word document.
 * Endpoint: POST /export/descriptive-stats-word
 *
 * Accepts two shapes:
 *   • DescriptiveStatsResponse — flat (from this module's handleExport)
 *   • Combined state object    — { response: DescriptiveStatsResponse, trait_columns, ... }
 *     as produced by some callers that store request + response together.
 *
 * Either way the payload sent to the backend is fully flat.
 * The nested "response" key is never forwarded.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportDescriptiveStats(currentData: DescriptiveStatsResponse | Record<string, any>): Promise<void> {
  guardProModule("export-word");
  const url = `${ENGINE_BASE}/export/descriptive-stats-word`;

  // Flatten: prefer fields from currentData.response if present, fall back to root.
  // This handles both the flat DescriptiveStatsResponse shape and the combined
  // { response: DescriptiveStatsResponse, trait_columns, genotype_column, ... } shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (currentData as any).response;

  const payload = {
    dataset_token:    (currentData as any).dataset_token ?? null,
    overview:         r?.overview         ?? (currentData as any).overview         ?? null,
    summary_table:    r?.summary_table    ?? (currentData as any).summary_table    ?? [],
    reliable_traits:  r?.reliable_traits  ?? (currentData as any).reliable_traits  ?? [],
    caution_traits:   r?.caution_traits   ?? (currentData as any).caution_traits   ?? [],
    global_flags:     r?.global_flags     ?? (currentData as any).global_flags     ?? [],
    recommendation:   r?.recommendation   ?? (currentData as any).recommendation   ?? "",
    // extra context fields — backend ignores them, kept for traceability
    trait_columns:       (currentData as any).trait_columns        ?? [],
    genotype_column:     (currentData as any).genotype_column      ?? null,
    rep_column:          (currentData as any).rep_column           ?? null,
    expected_replication: (currentData as any).expected_replication ?? null,
  };

  console.log(
    "[exportDescriptiveStats] POST", url,
    "| payload keys:", Object.keys(payload),
    "| overview present:", !!payload.overview,
    "| summary_table rows:", payload.summary_table?.length ?? 0,
  );

  let response: Response;
  try {
    response = await requestWithResilience(url, {
      method: "POST",
      headers: buildModeHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      timeoutMs: 180000,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error during descriptive stats export: ${msg}`);
  }

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    console.error("[exportDescriptiveStats] Server error", response.status, detail);
    throw new Error(`Descriptive stats export failed (${response.status}) — ${detail}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = "vivasense_descriptive_stats_report.docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/** Infer file_type from File.name */
export function inferFileType(file: File): "csv" | "xlsx" | "xls" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xls")) return "xls";
  return "xlsx";
}
