/**
 * Types for the Trait Association module.
 * Backend: POST /genetics/trait-association/analyze
 *
 * Shapes mirror the live TraitAssociationModuleRequest / TraitAssociationModuleResponse
 * verified against the production engine. The correlation and p-value matrices are
 * nested dictionaries keyed by trait name (not 2-D arrays).
 */

export type TraitAnalysisUnit = "genotype_mean" | "plot_level";
export type TraitEnvironmentContext = "single_environment" | "multi_environment";

/** REL-OPEN-01: rg-only, so always the governed genetic request
 *  (see src/lib/traitAssociationRequest.ts). */
export type { GovernedTraitAssociationRequest as TraitAssociationRequest } from "@/lib/traitAssociationRequest";

/** One significant trait–trait association. Fields are rendered defensively
 *  because the backend may evolve the exact key set. */
export interface TraitAssociationPair {
  trait_a?: string;
  trait_b?: string;
  r?: number;
  correlation?: number;
  p_value?: number;
  pvalue?: number;
  label?: string;
  [key: string]: unknown;
}

export interface TraitAssociationSummary {
  num_traits: number;
  num_significant_pairs: number;
  strongest_positive_pair_label: string | null;
  strongest_negative_pair_label: string | null;
}

export interface TraitAssociationResponse {
  module: string;
  analysis_unit: string;
  n_observations: number;
  alpha: number;
  environment_context: string;
  gxe_significant: boolean;
  trait_names: string[];
  /** Nested dict: correlation_matrix[traitRow][traitCol] = r. */
  correlation_matrix: Record<string, Record<string, number>>;
  /** Nested dict: pvalue_matrix[traitRow][traitCol] = p (or null). */
  pvalue_matrix: Record<string, Record<string, number | null>>;
  significant_pairs: TraitAssociationPair[];
  strongest_positive_pair: TraitAssociationPair | null;
  strongest_negative_pair: TraitAssociationPair | null;
  risk_flags: string[];
  summary: TraitAssociationSummary;
  heatmap?: { matrix: number[][]; type: string } | null;
  interpretation: string | null;
  warnings: string[];
  dataset_token: string;
}
