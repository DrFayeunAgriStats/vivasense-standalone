import {
  buildContextFields,
  type GeneticControlsState,
  type RelationshipAlpha,
  type RelationshipAnalysisContext,
} from "./relationshipGeneticContract";

export type { RelationshipAnalysisContext } from "./relationshipGeneticContract";
export type RelationshipCorrelationMethod = "pearson" | "spearman";
export type RelationshipCorrelationMode = "single" | "multi";

export interface RelationshipCorrelationRequest {
  base64_content: string;
  file_type: "csv" | "xlsx" | "xls";
  analysis_context: RelationshipAnalysisContext;
  genetic_material_confirmed: boolean;
  /** "not_required" for General (canonical); "rcbd" (explicitly selected) for genetic. */
  design: "not_required" | "rcbd";
  alpha: RelationshipAlpha;
  genotype_column: string | null;
  rep_column: string | null;
  environment_column: string | null;
  trait_columns: string[];
  method: RelationshipCorrelationMethod;
  mode: RelationshipCorrelationMode;
}

interface BuildRelationshipCorrelationRequestInput {
  base64Content: string;
  fileType: "csv" | "xlsx" | "xls";
  analysisContext: RelationshipAnalysisContext;
  /** A1 + A1b state; ignored (never sent) in General context. */
  geneticControls: GeneticControlsState;
  alpha?: RelationshipAlpha;
  genotypeColumn?: string | null;
  repColumn?: string | null;
  environmentColumn?: string | null;
  traitColumns: string[];
  method: RelationshipCorrelationMethod;
  mode: RelationshipCorrelationMode;
}

/**
 * Build the governed browser -> /genetics/correlation contract.
 *
 * General mode is deliberately structure-free: it sends no genotype, rep or
 * environment mapping and can never request model-based genetic quantities.
 * Breeding & Genetic mode is explicit opt-in and fails closed unless the user
 * confirms that the entries are genetic material.
 */
export function buildRelationshipCorrelationRequest(
  input: BuildRelationshipCorrelationRequestInput,
): RelationshipCorrelationRequest {
  const traits = input.traitColumns.map((t) => t.trim()).filter(Boolean);
  if (traits.length < 2) throw new Error("Select at least two numeric traits.");

  if (input.analysisContext === "general") {
    const ctx = buildContextFields("general", input.geneticControls, input.alpha ?? 0.05);
    return {
      base64_content: input.base64Content,
      file_type: input.fileType,
      ...ctx,
      genotype_column: null,
      rep_column: null,
      environment_column: null,
      trait_columns: traits,
      method: input.method,
      mode: "single",
    };
  }

  const genotype = (input.genotypeColumn ?? "").trim();
  const rep = (input.repColumn ?? "").trim();
  const environment = (input.environmentColumn ?? "").trim() || null;

  // Throws unless the A1 declaration is checked AND RCBD was explicitly chosen.
  const ctx = buildContextFields("genetic", input.geneticControls, input.alpha ?? 0.05);
  if (!genotype) throw new Error("Genotype / entry column is required in Breeding & Genetic mode.");
  if (!rep) throw new Error("Replication / block column is required in Breeding & Genetic mode.");
  if (input.mode === "multi" && !environment) {
    throw new Error("A multi-environment genetic correlation run requires an Environment column.");
  }

  return {
    base64_content: input.base64Content,
    file_type: input.fileType,
    ...ctx,
    genotype_column: genotype,
    rep_column: rep,
    environment_column: input.mode === "multi" ? environment : null,
    trait_columns: traits,
    method: input.method,
    mode: input.mode,
  };
}
