export type RelationshipCorrelationMethod = "pearson" | "spearman";
export type RelationshipCorrelationMode = "single" | "multi";
export type RelationshipAnalysisContext = "general" | "genetic";

export interface RelationshipCorrelationRequest {
  base64_content: string;
  file_type: "csv" | "xlsx" | "xls";
  analysis_context: RelationshipAnalysisContext;
  genetic_material_confirmed: boolean;
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
  geneticMaterialConfirmed: boolean;
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
    return {
      base64_content: input.base64Content,
      file_type: input.fileType,
      analysis_context: "general",
      genetic_material_confirmed: false,
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

  if (!input.geneticMaterialConfirmed) {
    throw new Error(
      "Breeding & Genetic mode requires confirmation that the entries are genetic material.",
    );
  }
  if (!genotype) throw new Error("Genotype / entry column is required in Breeding & Genetic mode.");
  if (!rep) throw new Error("Replication / block column is required in Breeding & Genetic mode.");
  if (input.mode === "multi" && !environment) {
    throw new Error("A multi-environment genetic correlation run requires an Environment column.");
  }

  return {
    base64_content: input.base64Content,
    file_type: input.fileType,
    analysis_context: "genetic",
    genetic_material_confirmed: true,
    genotype_column: genotype,
    rep_column: rep,
    environment_column: input.mode === "multi" ? environment : null,
    trait_columns: traits,
    method: input.method,
    mode: input.mode,
  };
}
