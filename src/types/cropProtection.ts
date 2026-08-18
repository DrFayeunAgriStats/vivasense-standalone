/**
 * Types for the Crop Protection Bioassay / Efficacy Analysis contract.
 *
 * Mirrors POST /crop-protection/bioassay/analyze exactly. The backend response
 * model types its top-level sections as open dictionaries, so these shapes were
 * derived by running the real endpoint against the backend's own fixtures
 * (dorcas_bioassay_48, al_cl_alcl_joint_action, cl_b_clb_joint_action) rather
 * than from the pydantic signature. Nothing here is speculative: every field
 * below appears in a captured response.
 */

// ── Request ────────────────────────────────────────────────────────────────

export type BioassayResponseType = "mortality" | "count" | "continuous";

export type ControlPolicy = "require_unique" | "deduplicate_identical_replicates";

export interface BioassayDataset {
  base64_content: string;
  file_type: "csv" | "xlsx" | "xls";
}

export interface BioassayDesignRequest {
  /** The backend accepts a single design for this workflow. */
  design_type: "crd";
  treatment_column: string;
  dose_column: string;
  /** Experimental-unit identifier. Never enters the model as a block. */
  replicate_column: string;
  control_treatment_level: string;
  expected_dose_series: number[];
}

export interface BioassayResponseDefinition {
  id: string;
  type: BioassayResponseType;
  /** Biological / display scale column. */
  raw_column: string;
  /** Column the ANOVA and Tukey grouping are computed on. */
  inference_column: string;
  display_column?: string | null;
  observation_time?: number | null;
  time_unit?: string | null;
  transformed_column?: string | null;
  /** Pre-computed Abbott column, used by the backend only to verify its own arithmetic. */
  corrected_column?: string | null;
  abbott_correction?: boolean;
  cumulative?: boolean;
}

export interface BioassayCotoxicityRequest {
  enabled: boolean;
  /** Bliss independence is the only implemented method. */
  method: "bliss";
  component_a_level: string;
  component_b_level: string;
  mixture_level: string;
  response_ids: string[];
  bootstrap_iterations?: number;
  confidence_level?: number;
  seed?: number | null;
  ceiling_threshold?: number;
}

export interface BioassayOptions {
  alpha?: number;
  floor_abbott_at_zero?: boolean;
  control_policy?: ControlPolicy;
  control_row_indices?: number[] | null;
  high_control_mortality_warning_threshold?: number | null;
}

export interface BioassayAnalysisRequest {
  dataset: BioassayDataset;
  design: BioassayDesignRequest;
  responses: BioassayResponseDefinition[];
  cotoxicity?: BioassayCotoxicityRequest | null;
  correlation_response_ids: string[];
  regression_response_ids: string[];
  options: BioassayOptions;
}

// ── Response ───────────────────────────────────────────────────────────────

export interface BioassayWarning {
  code: string;
  severity: "info" | "warning" | "error" | string;
  response_id: string | null;
  message: string;
  details: Record<string, unknown>;
}

export interface BioassayCellCount {
  treatment: string;
  dose: number;
  n: number;
}

export interface BioassayDesignSummary {
  design_type: string;
  total_rows: number;
  factorial_rows: number;
  control_rows: number;
  factorial_treatments: string[];
  dose_levels: number[];
  cells: number;
  balanced: boolean;
  cell_replication: number | null;
  cell_counts: BioassayCellCount[];
  replicate_role: string;
  control_rows_used: number[];
}

export interface AnovaRow {
  source: string;
  df: number;
  ss: number;
  ms: number;
  f_value: number | null;
  p_value: number | null;
}

export interface InteractionMean {
  treatment: string;
  dose: number;
  n: number;
  mean_inference_scale: number;
  mean_display_scale: number;
  se_inference_scale: number;
  se_display_scale: number;
  letter: string;
  /** Convenience aliases the backend adds: display-scale mean/SE plus the Tukey letter. */
  mean: number;
  se: number;
  tukey_letter: string;
}

/** Marginal means carry no Tukey letter — the backend does not compute one. */
export interface MarginalMean {
  level: string;
  n: number;
  mean_inference_scale: number;
  mean_display_scale: number;
  se_display_scale: number;
}

export interface AssumptionTest {
  test: string;
  grouping?: string;
  statistic: number;
  p_value: number;
  passed: boolean;
}

export interface BioassayDiagnostics {
  residual_normality: AssumptionTest | null;
  homogeneity: AssumptionTest | null;
}

export type AbbottStatus = "reference_control" | "calculated" | string;

export interface AbbottRow {
  source_row: number;
  treatment: string;
  dose: number;
  replicate: string;
  observation_time: number;
  time_unit: string;
  raw_mortality: number;
  transformed_mortality: number | null;
  raw_abbott_value: number | null;
  display_abbott_value: number | null;
  floor_applied: boolean;
  abbott_status: AbbottStatus;
}

export interface MortalityCorrection {
  abbott_applied: boolean;
  scales: { raw: string; inference: string; corrected: string | null };
  control_n: number;
  control_mean_raw_mortality: number;
  control_policy: string;
  duplicates_removed: number;
  /** Populated only when Abbott correction was requested for the response. */
  rows: AbbottRow[];
  verification: {
    supplied_column: string | null;
    max_absolute_difference: number | null;
    mismatch_count: number;
    verification_status: string;
  };
  warnings: string[];
}

export interface ResponseInterpretation {
  treatment_significant: boolean;
  dose_significant: boolean;
  interaction_significant: boolean;
  interpretation_priority: "interaction" | "main_effects" | string;
}

export interface ResponseProvenance {
  response_id: string;
  biological_type: string;
  raw_column: string;
  inference_column: string;
  display_column: string;
  transformation: "explicit" | "none" | string;
  abbott_applied: boolean;
  control_rows_used: number[];
  factorial_rows_used: number[];
  excluded_rows: number[];
  alpha: number;
  software_engine: string;
}

export interface BioassayResponseResult {
  response_id: string;
  biological_type: BioassayResponseType | string;
  anova: AnovaRow[];
  interaction: { significant: boolean; means: InteractionMean[] };
  /** Interaction means when the interaction is significant, marginal means otherwise. */
  primary_mean_separation: unknown;
  treatment_marginal_means: MarginalMean[];
  dose_marginal_means: MarginalMean[];
  diagnostics: BioassayDiagnostics;
  mortality_correction: MortalityCorrection | null;
  interpretation_metadata: ResponseInterpretation;
  provenance: ResponseProvenance;
}

export type CotoxicityInference =
  | "supports_synergy_under_bliss"
  | "supports_antagonism_under_bliss"
  | "not_distinguishable_from_additivity"
  | "ceiling_limited"
  | string;

export type CotoxicityDirection = "positive_deviation" | "negative_deviation" | string;

export interface CotoxicityComponent {
  level: string;
  n: number;
  mean_corrected_mortality: number;
}

export interface CotoxicityCell {
  dose: number;
  observation_time: number;
  time_unit: string;
  available: boolean;
  component_a: CotoxicityComponent;
  component_b: CotoxicityComponent;
  mixture: CotoxicityComponent;
  bliss_expected: number | null;
  excess_observed_minus_expected: number | null;
  observed_expected_ratio: number | null;
  bootstrap_ci: {
    low: number;
    high: number;
    confidence_level: number;
    bootstrap_iterations: number;
    resampling: string;
    seed: number | null;
  } | null;
  descriptive_direction: CotoxicityDirection | null;
  inference: CotoxicityInference | null;
  ceiling_effect: boolean;
  warnings: string[];
}

export interface CotoxicityTimeSummary {
  observation_time: number;
  time_unit: string;
  number_of_matched_doses: number;
  number_positive: number;
  number_additive: number;
  number_negative: number;
  number_supporting_synergy: number;
  number_supporting_antagonism: number;
  number_inconclusive: number;
  number_ceiling_limited: number;
}

export interface CotoxicityByTime {
  observation_time: number;
  time_unit: string;
  cells: CotoxicityCell[];
  summary: CotoxicityTimeSummary;
}

export interface CotoxicityResult {
  method: string;
  component_a: string;
  component_b: string;
  mixture: string;
  by_time: CotoxicityByTime[];
  provenance: Record<string, unknown>;
}

export interface RegressionRow {
  treatment: string;
  response_id: string;
  n: number;
  scale: string;
  control_included: boolean;
  status: "success" | "insufficient_dose_variation" | "constant_response" | string;
  intercept: number | null;
  slope: number | null;
  r_squared: number | null;
  p_value: number | null;
  significance: "significant" | "not_significant" | "unavailable" | string;
  direction: "increasing" | "decreasing" | "constant" | "unavailable" | string;
}

export interface CorrelationRow {
  response_a: string;
  response_b: string;
  n: number;
  r: number | null;
  p_value: number | null;
  status: "success" | "insufficient_variation" | string;
  scale?: string;
  population?: string;
}

export interface CumulativeMortalityValidation {
  checked: boolean;
  scale_checked: string;
  decrease_count: number;
  decreases: {
    treatment: string;
    dose: number;
    replicate: string;
    from_time: number;
    to_time: number;
    from_raw_mortality: number;
    to_raw_mortality: number;
  }[];
  warnings: string[];
}

export interface BioassayAnalysisResponse {
  status: "success";
  analysis_type: "crop_protection_bioassay";
  design: BioassayDesignSummary;
  warnings: BioassayWarning[];
  response_results: BioassayResponseResult[];
  cotoxicity: CotoxicityResult | null;
  regression: RegressionRow[];
  correlation: CorrelationRow[];
  cumulative_mortality_validation: CumulativeMortalityValidation | null;
  interpretation_metadata: {
    by_response: Record<string, ResponseInterpretation>;
    dose_response_direction: Record<string, string>;
    control_warning_present: boolean;
    assumption_warning_present: boolean;
  };
  result_order: string[];
  provenance: Record<string, unknown>;
}

// ── Client-side form state ─────────────────────────────────────────────────

/** What the researcher configures for one response before the request is built. */
export interface ResponseDraft {
  key: string;
  id: string;
  type: BioassayResponseType;
  rawColumn: string;
  inferenceColumn: string;
  observationTime: string;
  timeUnit: string;
  abbottCorrection: boolean;
  cumulative: boolean;
}
