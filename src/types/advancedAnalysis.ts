/**
 * Types for VivaSense Advanced Analysis modules:
 * /analysis/stability, /analysis/blup, /analysis/pca, /analysis/cluster
 */

// ── Stability (Eberhart-Russell + Shukla + AMMI + GGE) ─────────────────────

export type StabilityClass =
  | "stable"
  | "responsive_favorable"
  | "responsive_poor"
  | "unpredictable"
  | "responsive"
  | "highly stable"
  | "moderately stable"
  | "unstable"
  | string;

export type StabilityMethod = "eberhart-russell" | "shukla" | "wricke" | "ammi" | "gge-biplot";
export type GgeBiplotType = "which-won-where" | "mean-stability" | "discriminativeness";

export interface StabilityRow {
  genotype: string;
  mean: number;
  bi: number;
  /** S²d_i: adjusted for the pooled error when available, else the unadjusted deviation MS (see s2di_basis); null if not estimable. */
  s2di: number | null;
  s2di_basis?: "adjusted_for_pooled_error" | "unadjusted_deviation_ms" | "not_estimable";
  shukla_variance?: number;
  /** LEGACY: rank by MEAN performance, not a stability rank. See the rank_* fields. */
  rank: number;
  stability_class: StabilityClass;
  stability_description?: string | null;
  /** Neutral, exploratory label. The class id above is kept for API compatibility and is NOT a recommendation. */
  stability_class_label?: string | null;
  classification_status?: "exploratory_provisional" | string | null;
  b_se?: number | null;
  b_t_vs_1?: number | null;
  b_p_vs_1?: number | null;
  b_ci_low?: number | null;
  b_ci_high?: number | null;
  b_se_pooled?: number | null;
  b_t_pooled?: number | null;
  b_p_pooled?: number | null;
  b_exact_fit?: boolean | null;
  /** ok | exact_fit | indeterminate | unavailable: numerical status of the own-deviation b = 1 test (inference is withheld for exact_fit and indeterminate). */
  b_inference_status?: "ok" | "exact_fit" | "indeterminate" | "unavailable" | string | null;
  deviation_resolution?: number | null;
  deviation_ms?: number | null;
  s2di_f?: number | null;
  s2di_p?: number | null;
  ecovalence?: number | null;
  ecovalence_pct?: number | null;
  rank_mean?: number | null;
  rank_ecovalence?: number | null;
  rank_shukla?: number | null;
  rank_s2di?: number | null;
  rank_abs_b_minus_1?: number | null;
  rank_sum_kang?: number | null;
}

export interface StabilityAssumptions {
  design: "rcbd" | "crd" | "unspecified";
  balanced_replication: boolean;
  replicates: number | null;
  pooled_error_available: boolean;
  pooled_error_reason: string | null;
  mse: number | null;
  df_error: number | null;
  bartlett: { statistic: number; df: number; p_value: number; mse_ratio_max_min: number } | null;
  model: string;
  cautions?: string[];
  primary_b_test?: { primary: string; alternative: string; status: string; note: string };
}

export interface StabilityVerification {
  status: "verified" | "unverified";
  reasons: string[];
  engine: string;
  engine_version: string;
  r_version?: string | null;
  crosscheck?: { status: string; n_checks: number; discrepancies: string[] } | null;
}

// ── AMMI ───────────────────────────────────────────────────────────────────

export interface AmmiAnovaTable {
  source: string[];
  df: number[];
  sum_sq: number[];
  mean_sq: number[];
  f_value: number[];
  p_value: number[];
}

export interface GenotypeIPCA {
  genotype: string;
  mean: number;
  ipca1: number;
  ipca2: number;
  ipca3?: number;
}

export interface EnvironmentIPCA {
  environment: string;
  mean: number;
  ipca1: number;
  ipca2: number;
}

export interface GenotypeASV {
  genotype: string;
  mean?: number;
  asv: number;
  rank: number;
  /** DEPRECATED: no class is assigned any more (quantile labels always produced 'unstable' genotypes); ranks only. */
  stability_class?: string | null;
}

export interface AmmiBiplotPoint {
  code?: string;
  genotype?: string;
  environment?: string;
  mean?: number;
  pc1?: number;
  pc2?: number;
  ipca1?: number;
  ipca2?: number;
}

export interface AmmiBiplotData {
  genotypes: AmmiBiplotPoint[];
  environments: AmmiBiplotPoint[];
}

export interface AmmiAnovaRow {
  source: string; ss: number; df: number; ms: number; f: number | null; p: number | null; tested_against?: string | null;
}
export interface AmmiIpcaRow {
  axis: number; singular_value: number; ss: number; df: number; ms: number | null; f: number | null; p: number | null;
  pct_of_interaction: number; cumulative_pct: number;
}

export interface AMMIResults {
  /** Legacy shape (never produced by the backend). */
  anova_table?: AmmiAnovaTable;
  /** Combined fixed-effects ANOVA from the R engine; null when no valid replicated design (reason in assumptions). */
  anova?: AmmiAnovaRow[] | null;
  ipca_table?: AmmiIpcaRow[] | null;
  n_components?: number | null;
  asv_convention?: string | null;
  gollob_note?: string | null;
  assumptions?: { design?: string; replicates?: number | null; pooled_error_available?: boolean; pooled_error_reason?: string | null; mse?: number | null; df_error?: number | null } | null;
  cautions?: string[] | null;
  input_notes?: string[] | null;
  verification_status?: "verified" | "unverified" | null;
  verification_reasons?: string[] | null;
  engine?: string | null;
  variance_explained: number[];
  cumulative_variance: number[];
  genotype_scores: GenotypeIPCA[];
  environment_scores: EnvironmentIPCA[];
  stability_measure: GenotypeASV[];
  biplot_data: AmmiBiplotData;
  interpretation: string;
}

// ── GGE ────────────────────────────────────────────────────────────────────

export interface GenotypePC {
  genotype: string;
  mean: number;
  pc1: number;
  pc2: number;
}

export interface EnvironmentPC {
  environment: string;
  mean: number;
  pc1: number;
  pc2: number;
}

export interface MegaEnvironment {
  id: number;
  environments: string[];
  best_genotype: string;
  mean_yield: number;
}

export interface GgeSectorBoundary {
  between: [string, string];
  direction: { pc1: number; pc2: number };
  angle_deg: number;
}

export interface GgeEnvironmentAssignment {
  environment: string;
  biplot_winner: string | null;
  tied_with: string[];
  observed_winner: string;
  agrees_with_observed: boolean | null;
  note: string | null;
}

export interface WhichWonWhere {
  mega_environments: MegaEnvironment[];
  winning_genotypes: Record<string, string>;
  interpretation: string;
  // gge-2.0.0 (optional)
  polygon_vertices?: string[];
  sector_boundaries?: GgeSectorBoundary[];
  sectors?: { vertex_genotype: string; environments: string[] }[];
  environment_assignments?: GgeEnvironmentAssignment[];
  n_biplot_observed_disagreements?: number;
  /** Sector-ASSIGNMENT consistency (geometry); distinct from rank-2-vs-observed differences above. */
  sector_geometry_check?: { n_checked: number; n_disagree: number };
}

export interface GenotypeDistance {
  genotype: string;
  distance_from_ideal: number;
  rank: number;
}

export interface MeanVsStability {
  ideal_genotype: string;
  ideal_coordinates: { pc1: number; pc2: number };
  genotype_distances: GenotypeDistance[];
  interpretation: string;
  // gge-2.0.0 (optional)
  aec_direction?: { pc1: number; pc2: number };
  average_environment?: { pc1: number; pc2: number };
  genotype_aec?: {
    genotype: string;
    observed_mean: number;
    aec_abscissa: number;
    aec_ordinate: number;
    instability: number;
    distance_from_ideal: number;
    rank: number;
  }[];
  spearman_aec_vs_observed_mean?: number | null;
}

export interface GgeEnvironmentEvaluation {
  aec_direction: { pc1: number; pc2: number };
  ideal_point: { pc1: number; pc2: number };
  ideal_environment: string;
  environments: {
    environment: string;
    vector_length: number;
    observed_sd: number;
    angle_with_aec_deg: number | null;
    cos_with_aec: number | null;
    distance_from_ideal: number | null;
    rank: number | null;
  }[];
  interpretation: string;
}

export interface GGEResults {
  variance_explained: number[];
  cumulative_variance: number;
  genotype_scores: GenotypePC[];
  environment_scores: EnvironmentPC[];
  which_won_where?: WhichWonWhere;
  mean_vs_stability?: MeanVsStability;
  biplot_data: { genotypes: GenotypePC[]; environments: EnvironmentPC[] };
  interpretation: string;
  // gge-2.0.0 (optional)
  engine_version?: string;
  view?: GgeBiplotType;
  centering?: "environment";
  scaling?: "none" | "sd";
  svp?: "genotype" | "environment" | "symmetrical";
  variance_explained_all?: number[];
  singular_values?: number[];
  environment_evaluation?: GgeEnvironmentEvaluation | null;
  replicates_per_cell?: { min: number; max: number };
  warnings?: string[];
  variance_label?: string;
  /** "r" = authoritative R engine; "python" = explicit, disclosed override. */
  engine?: "r" | "python";
  r_version?: string | null;
  /** Independent Python cross-check of the R result. */
  engine_crosscheck?: {
    status: "agree" | "disagree";
    n_checks: number;
    discrepancies: string[];
    r_engine_version?: string;
    python_engine_version?: string;
  } | null;
  /** "verified" only when the R engine AND the independent cross-check agreed. */
  verification_status?: "verified" | "unverified";
  verification_reasons?: string[];
}

export interface StabilityResponse {
  status: "success" | "failed" | "error";
  trait: string;
  n_genotypes: number;
  n_environments: number;
  methods_computed?: string[];
  genotype_stability: StabilityRow[];
  environment_means: Record<string, number>;
  grand_mean: number;
  /** DEPRECATED: always empty (it was a selection-supportive list). Use genotypes_not_flagged. */
  best_stable_genotypes: string[];
  /** Genotypes whose b_i = 1 and S2d_i = 0 tests were not rejected. Absence of evidence of deviation, NOT proof of stability. */
  genotypes_not_flagged?: string[];
  deprecated_fields?: Record<string, string> | null;
  ammi_results?: AMMIResults;
  gge_results?: GGEResults;
  interpretation: string;
  plot_data?: unknown;
  method_errors?: Record<string, string> | null;
  /** Rows excluded / suspicious labels disclosed by the backend before analysis. */
  input_notes?: string[] | null;
  stability_assumptions?: StabilityAssumptions | null;
  stability_verification?: StabilityVerification | null;
  /** Audit of the ORIGINAL data: counts, reasons, affected cells, whether the researcher authorised exclusion. */
  input_audit?: {
    n_rows: number; n_invalid: number; n_valid: number; exclusion_authorised: boolean;
    reasons?: Record<string, number>;
    affected_cells?: { genotype: string; environment: string; n_excluded: number; n_remaining: number; n_original: number }[];
  } | null;
}

export interface StabilityRequest {
  dataset_token: string;
  trait_column: string;
  /** Researcher-selected. false (default): invalid observations REFUSE the analysis. true: they are excluded and reported. */
  exclude_invalid_observations?: boolean;
  methods?: StabilityMethod[];
  biplot_type?: GgeBiplotType;
  ammi_components?: number;
  stability_design?: "rcbd" | "crd";
  alpha?: number;
  gge_scaling?: "none" | "sd";
  gge_svp?: "genotype" | "environment" | "symmetrical";
}

// ── BLUP ────────────────────────────────────────────────────────────────────

export interface BlupRow {
  genotype: string;
  blup: number;
  se: number;
  reliability: number;
  rank: number;
}

export interface BlupResponse {
  status: "success" | "failed";
  trait: string;
  model_type: "single-environment" | "multi-environment";
  genotype_blups: BlupRow[];
  best_genotypes: string[];
  variance_components: {
    genotype: number;
    residual: number;
    environment?: number;
  };
  interpretation: string;
}

export interface BlupRequest {
  dataset_token: string;
  trait_column: string;
  random_effects: string[];
  fixed_effects?: string[];
}

// ── PCA ─────────────────────────────────────────────────────────────────────

export interface PcaScore {
  genotype: string;
  scores: number[];
}

export interface PcaResponse {
  status: "success" | "failed";
  n_traits: number;
  n_genotypes: number;
  variance_explained: number[];
  cumulative_variance: number[];
  loadings: Record<string, number[]>;
  scores: PcaScore[];
  biplot_data?: {
    loadings: Record<string, number[]>;
    scores: PcaScore[];
  };
  interpretation: string;
  /** R-engine fields (additive). */
  matrix?: "correlation" | "covariance" | null;
  eigenvalues?: number[] | null;
  correlation_loadings?: Record<string, number[]> | null;
  broken_stick_pct?: number[] | null;
  excluded_traits?: { trait: string; reason: string }[] | null;
  excluded_genotypes?: { genotype: string; missing_traits: string[] | string }[] | null;
  input_notes?: string[] | null;
  warnings?: string[] | null;
  sign_convention?: string | null;
  verification_status?: "verified" | "partially_verified" | "unverified" | null;
  verification_reasons?: string[] | null;
  engine?: string | null;
  /** Manus PCA audit corrections (additive; absent from older responses). */
  analysis_context?: { is_single_environment?: boolean; environment_count?: number | null; design_type?: string | null } | null;
  verification_coverage?: Record<string, unknown> | null;
  rank?: number | null;
  null_components?: number | null;
  n_components?: number | null;
  requested_n_components?: number | null;
  broken_stick_dimension?: number | null;
  environment_context?: { environment_count?: number | null; pooling_statement?: string | null; [k: string]: unknown } | null;
  trait_means?: Record<string, number> | null;
  trait_sds?: Record<string, number> | null;
  n_obs_per_cell?: Record<string, Record<string, number>> | null;
  dataset_dropped_empty_columns?: string[] | null;
  provenance?: Record<string, unknown> | null;
}

export interface PcaRequest {
  dataset_token: string;
  trait_columns: string[];
  /** 'refuse' (default): a genotype with a missing trait mean refuses the analysis. 'exclude_genotypes': listwise exclusion, disclosed. */
  on_missing?: "refuse" | "exclude_genotypes";
  /** 'refuse' (default) or 'exclude_traits' (constant traits dropped, disclosed). */
  on_zero_variance?: "refuse" | "exclude_traits";
  scale?: boolean;
  n_components?: number | null;
}

// ── Cluster ─────────────────────────────────────────────────────────────────

export interface ClusterAssignment {
  genotype: string;
  cluster_id: number;
  silhouette_score?: number;
}

export interface ClusterSummary {
  cluster_id: number;
  size: number;
  mean_per_trait: Record<string, number>;
}

export interface ClusterResponse {
  status: "success" | "failed";
  n_genotypes: number;
  n_traits: number;
  method: string;
  optimal_k: number;
  cluster_assignments: ClusterAssignment[];
  cluster_summary: ClusterSummary[];
  silhouette_scores: number[];
  dendrogram_data?: unknown;
  interpretation: string;
}

export interface ClusterRequest {
  dataset_token: string;
  trait_columns: string[];
  method?: "single" | "complete" | "average" | "ward";
  k?: number | null;
  scale?: boolean;
}

// ── Non-Parametric Tests ────────────────────────────────────────────────────

export type NonparametricTestType = "kruskal-wallis" | "friedman" | "dunn";

export interface NonparametricRequest {
  dataset_token: string;
  trait_column: string;
  group_column: string;
  test_type: NonparametricTestType;
  block_column?: string;
  alpha?: number;
}

export interface NonparametricGroupRow {
  group: string;
  n?: number;
  median?: number;
  mean_rank?: number;
}

export interface NonparametricPosthocRow {
  group_a: string;
  group_b: string;
  statistic?: number;
  p_value?: number;
  p_adjusted?: number;
  significant?: boolean;
}

export interface NonparametricResponse {
  status: "success" | "failed" | "error";
  test_type: string;
  trait?: string;
  group_column?: string;
  statistic?: number;
  p_value?: number;
  significant?: boolean;
  alpha?: number;
  df?: number;
  group_summary?: NonparametricGroupRow[];
  posthoc_results?: NonparametricPosthocRow[];
  assumptions_met?: Record<string, boolean | string>;
  interpretation?: string;
}

// ── MANOVA ──────────────────────────────────────────────────────────────────

export type ManovaTestStat = "Wilks" | "Pillai" | "Hotelling-Lawley" | "Roy";

export interface ManovaRequest {
  dataset_token: string;
  trait_columns: string[];
  factor_column: string;
  covariates?: string[];
  test_statistic?: ManovaTestStat;
  alpha?: number;
}

export interface ManovaTestRow {
  effect: string;
  test_statistic?: string;
  value?: number;
  f_statistic?: number;
  num_df?: number;
  den_df?: number;
  p_value?: number;
  significant?: boolean;
}

export interface ManovaUnivariateRow {
  trait: string;
  f_statistic?: number;
  p_value?: number;
  eta_squared?: number;
  significant?: boolean;
}

export interface ManovaCoordinate {
  label: string;
  group?: string;
  x: number;
  y: number;
}

export interface ManovaResponse {
  status: "success" | "failed" | "error";
  test_statistic?: string;
  statistic_value?: number;
  f_statistic?: number;
  p_value?: number;
  significant?: boolean;
  manova_table?: ManovaTestRow[];
  univariate_results?: ManovaUnivariateRow[];
  coordinates?: ManovaCoordinate[];
  assumptions_note?: string;
  interpretation?: string;
}

// ── Path Analysis ───────────────────────────────────────────────────────────

export type PathAnalysisMethod = "correlation" | "covariance";

export interface PathAnalysisRequest {
  dataset_token: string;
  outcome_trait: string;
  predictor_traits: string[];
  method?: PathAnalysisMethod;
  standardize?: boolean;
}

export interface PathCoefficientRow {
  predictor: string;
  direct_effect: number;
  std_error?: number;
  t_statistic?: number;
  p_value?: number;
  significant?: boolean;
}

export interface PathDecompositionRow {
  predictor: string;
  total_correlation?: number;
  direct_effect?: number;
  indirect_effect?: number;
  percent_direct?: number;
}

export interface PathDiagramNode { id: string; label?: string; type?: "predictor" | "outcome" | "residual"; }
export interface PathDiagramEdge { source: string; target: string; weight: number; significant?: boolean; }
export interface PathDiagramData { nodes?: PathDiagramNode[]; edges?: PathDiagramEdge[]; }

export interface PathAnalysisResponse {
  status: "success" | "failed" | "error";
  outcome_trait?: string;
  predictor_traits?: string[];
  n_observations?: number;
  r_squared?: number;
  residual_effect?: number;
  path_coefficients?: PathCoefficientRow[];
  correlation_decomposition?: PathDecompositionRow[];
  indirect_effects?: Record<string, Record<string, number>> | unknown;
  path_diagram_data?: PathDiagramData;
  interpretation?: string;
  // Legacy / alternate field names tolerated from earlier backend versions
  outcome?: string;
  n_predictors?: number;
  decomposition?: PathDecompositionRow[];
  [key: string]: unknown;
}

// ── Selection Index ─────────────────────────────────────────────────────────

export interface SelectionIndexRequest {
  dataset_token: string;
  trait_columns: string[];
  economic_weights: Record<string, number>;
  genetic_parameters?: Record<string, number>;
  genetic_correlations?: number[][];
  selection_intensity?: number;
}

export interface SelectionIndexWeight {
  trait: string;
  weight: number;
}

export interface SelectionRanking {
  genotype: string;
  index_value: number;
  rank: number;
  selected?: boolean;
}

export interface ExpectedGainRow {
  trait: string;
  expected_gain: number;
  percent_gain?: number;
}

export interface RelativeEfficiencyRow {
  trait: string;
  efficiency: number;
}

export interface SelectionIndexResponse {
  status: "success" | "failed" | "error";
  selection_accuracy?: number;
  total_merit?: number;
  n_selected?: number;
  top_genotype?: string;
  selection_intensity?: number;
  index_weights?: SelectionIndexWeight[];
  rankings?: SelectionRanking[];
  selected_genotypes?: string[];
  expected_gain?: ExpectedGainRow[];
  relative_efficiency?: RelativeEfficiencyRow[];
  interpretation?: string;
}
