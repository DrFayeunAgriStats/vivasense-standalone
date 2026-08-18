/**
 * Types for VivaSense Genetics Upload & Correlation workflows.
 */

// ── Shared dataset context ──────────────────────────────────────────────────

export interface DatasetContext {
  file: File;
  base64Content: string;
  fileType: "csv" | "xlsx" | "xls";
  genotypeColumn: string;
  repColumn: string;
  environmentColumn: string | null;
  /**
   * Columns whose interaction defines the environment when no single explicit
   * Environment column exists — e.g. ["Location", "Year"] for a trial run at
   * 3 locations over 3 years (9 environments, not 3).
   *
   * Used ONLY when environmentColumn is null: an explicitly supplied
   * Environment column always takes precedence and is never overwritten.
   * An ordered list rather than a fixed Location/Year pair so season or
   * management regime can be added later without reshaping this type.
   */
  environmentFactorColumns?: string[];
  availableTraitColumns: string[];
  mode: "single" | "multi";
  /** Server-issued token from /genetics/upload-preview — required for stateful endpoints like /analysis/descriptive-stats */
  datasetToken?: string | null;
  /** All column names from the uploaded file — used by design selectors (e.g. factorial / split-plot factor columns). */
  columns?: string[];
  /** Alias of `columns` for components that prefer this name. */
  availableColumns?: string[];
}

// ── Upload preview ──────────────────────────────────────────────────────────

export interface DetectedColumn {
  column: string;
  confidence: "high" | "medium" | "low";
}

export interface UploadPreviewResponse {
  detected_columns: {
    genotype: DetectedColumn | null;
    rep: DetectedColumn | null;
    environment: DetectedColumn | null;
    traits: string[];
  };
  n_rows: number;
  n_columns: number;
  data_preview: Record<string, unknown>[];
  mode_suggestion: "single" | "multi";
  column_names: string[];
  warnings: string[];
  /** Server-issued token used by stateful analysis endpoints */
  dataset_token?: string;
}

// ── Analyze-upload ──────────────────────────────────────────────────────────

export type AnalysisModule = "anova" | "genetic_parameters" | "correlation" | "heatmap";

export type AnovaDesignType = "crd" | "rcbd" | "factorial" | "factorial_rcbd" | "split_plot_rcbd";

export interface AnalyzeUploadRequest {
  base64_content: string;
  file_type: string;
  genotype_column: string;
  rep_column: string;
  environment_column: string | null;
  trait_columns: string[];
  mode: "single" | "multi";
  random_environment: boolean;
  selection_intensity: number;
  module: AnalysisModule;
  /** ANOVA design hint — backend routes ANOVA computation by this */
  design_type?: AnovaDesignType;
  /** Treatment column for CRD/RCBD */
  treatment_column?: string;
  /** Factor A column for factorial / factorial_rcbd */
  factor_a_column?: string;
  /** Factor B column for factorial / factorial_rcbd */
  factor_b_column?: string;
  /** Optional Factor C column for 3-way factorial */
  factor_c_column?: string;
  /** Main-plot factor column for split_plot_rcbd */
  main_plot_column?: string;
  /** Subplot factor column for split_plot_rcbd */
  sub_plot_column?: string;
}

export interface TraitSummaryRow {
  trait: string;
  grand_mean: number;
  h2: number;
  gcv: number;
  pcv: number;
  gam_percent: number;
  heritability_class: string;
  status: string;
  error: string | null;
}

export interface VarianceComponents {
  sigma2_genotype: number;
  sigma2_error: number;
  sigma2_ge: number | null;
  sigma2_phenotypic: number;
}

export interface TraitAnalysisResult {
  status: string;
  analysis_result: {
    status: string;
    mode: string;
    data_validation: { is_valid: boolean; warnings: string[] };
    variance_warnings: { is_valid: boolean; warnings: string[] };
    result: {
      environment_mode: string;
      n_genotypes: number;
      n_reps: number;
      n_environments: number | null;
      grand_mean: number;
      variance_components: VarianceComponents;
      heritability: {
        h2_broad_sense: number;
        interpretation_basis: string;
      };
      genetic_parameters: {
        GCV: number;
        PCV: number;
        GAM: number;
        GAM_percent: number;
        selection_intensity: number;
      };
      anova_table?: Record<string, unknown>;
      mean_separation?: Record<string, unknown>;
    };
    interpretation: string;
  };
  error: string | null;
  data_warnings: string[];
}

export interface AnalyzeUploadResponse {
  summary_table: TraitSummaryRow[];
  trait_results: Record<string, TraitAnalysisResult>;
  dataset_summary: {
    n_genotypes: number;
    n_reps: number;
    n_environments: number | null;
    n_traits: number;
    mode: string;
  };
  failed_traits: string[];
}

// ── Dataset registration (POST /upload/dataset) ─────────────────────────────

/**
 * Confirms a column mapping server-side and returns a token whose cached
 * context carries THAT mapping.
 *
 * The token handed back by /genetics/upload-preview is registered from
 * auto-detected columns, and /analysis/* endpoints read the mapping from the
 * token's context — they do not accept column roles in their own body. So an
 * analysis that depends on an explicitly declared genotype column must register
 * the declaration here first, or the backend would silently analyse whichever
 * column detection happened to pick.
 */
export interface RegisterDatasetRequest {
  base64_content: string;
  file_type: string;
  genotype_column?: string | null;
  rep_column?: string | null;
  environment_column?: string | null;
  factor_column?: string | null;
  main_plot_column?: string | null;
  sub_plot_column?: string | null;
  design_type: "crd" | "rcbd" | "factorial" | "split_plot_rcbd";
  mode: "single" | "multi";
  random_environment?: boolean;
  selection_intensity?: number;
}

export interface RegisterDatasetResponse {
  dataset_token: string;
  n_genotypes: number | null;
  n_reps: number;
  n_environments: number | null;
  n_rows: number;
  column_names: string[];
  mode: string;
  design_type: string;
}

// ── Genetic parameters module (POST /analysis/genetic-parameters) ───────────

export interface GeneticParametersRequest {
  dataset_token: string;
  trait_columns: string[];
  /**
   * Column roles are resolved from the dataset token's cached context; these are
   * sent so the request is self-describing (and forward-compatible if the
   * endpoint starts honouring them). They are NOT a substitute for registering
   * the mapping — see RegisterDatasetRequest.
   */
  genotype_column: string;
  rep_column: string | null;
  design_type: "crd" | "rcbd";
  mode: "single";
}

export interface GeneticParametersTraitResult {
  trait: string;
  status: string;
  grand_mean?: number | null;
  descriptive_stats?: Record<string, number | null> | null;
  /** Populated only on a genuine genetics run — {} means the analysis did not complete. */
  variance_components?: Record<string, number | null> | null;
  heritability?: Record<string, number | string | null> | null;
  gcv?: number | null;
  pcv?: number | null;
  /** Genetic advance (absolute units). */
  ga?: number | null;
  /** Genetic advance as % of the grand mean. */
  gam?: number | null;
  breeding_implication?: string | null;
  interpretation?: string | null;
  data_warnings?: string[];
  error?: string | null;
  analysis_context?: {
    is_single_environment?: boolean;
    environment_count?: number;
    design_type?: string;
  } | null;
}

export interface GeneticParametersResponse {
  dataset_token: string;
  mode: string;
  domain?: string | null;
  trait_results: Record<string, GeneticParametersTraitResult>;
  failed_traits: string[];
}

// ── Correlation ─────────────────────────────────────────────────────────────

export interface CorrelationRequest {
  base64_content: string;
  file_type: string;
  genotype_column: string;
  rep_column: string;
  environment_column: string | null;
  trait_columns: string[];
}

export type CorrelationModeKey = "phenotypic" | "between_genotype" | "genotypic";

export interface CorrelationModeBlock {
  // Matrix shape (legacy / multi-trait)
  r_matrix?: number[][];
  p_matrix?: (number | null)[][];
  n_observations?: number | null;
  available: boolean;
  note?: string | null;
  fallback_used?: boolean;
  // Scalar pairwise shape (new backend, 2-trait pair)
  r?: number;
  rg?: number;
  p_value?: number;
  df?: number;
  critical_r?: number;
  ci_lower?: number;
  ci_upper?: number;
  n_genotypes?: number;
}

export interface CorrelationResponse {
  trait_names: string[];
  method?: string;
  // Legacy single-matrix fields (kept for back-compat)
  r_matrix?: number[][];
  p_matrix?: (number | null)[][];
  n_observations?: number | null;
  warnings: string[];
  statistical_note: string;
  interpretation: string;
  // New 3-mode fields (optional — present when backend supports it)
  phenotypic?: CorrelationModeBlock;
  between_genotype?: CorrelationModeBlock;
  genotypic?: CorrelationModeBlock;
  modes_available?: CorrelationModeKey[];
}
