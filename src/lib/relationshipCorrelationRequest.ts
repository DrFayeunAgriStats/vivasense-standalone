export type RelationshipCorrelationMethod = "pearson" | "spearman";
export type RelationshipCorrelationMode = "single" | "multi";

export interface RelationshipCorrelationRequest {
  base64_content: string;
  file_type: "csv" | "xlsx" | "xls";
  genotype_column: string;
  rep_column: string;
  environment_column: string | null;
  trait_columns: string[];
  method: RelationshipCorrelationMethod;
  mode: RelationshipCorrelationMode;
}

interface BuildRelationshipCorrelationRequestInput {
  base64Content: string;
  fileType: "csv" | "xlsx" | "xls";
  genotypeColumn: string;
  repColumn: string;
  environmentColumn?: string | null;
  traitColumns: string[];
  method: RelationshipCorrelationMethod;
  mode: RelationshipCorrelationMode;
}

/**
 * Build the exact browser -> /genetics/correlation contract.
 *
 * The relationship release depends on mode/environment reaching the backend:
 * multi-environment data must never silently fall back to a genotype-only pooled
 * rg. Pearson/Spearman applies only to the observed plot-level and genotype-mean
 * quantities; the model-based rg estimator is unchanged by this selector.
 */
export function buildRelationshipCorrelationRequest(
  input: BuildRelationshipCorrelationRequestInput,
): RelationshipCorrelationRequest {
  const genotype = input.genotypeColumn.trim();
  const rep = input.repColumn.trim();
  const environment = (input.environmentColumn ?? "").trim() || null;
  const traits = input.traitColumns.map((t) => t.trim()).filter(Boolean);

  if (!genotype) throw new Error("Genotype column is required.");
  if (!rep) throw new Error("Replication / block column is required.");
  if (traits.length < 2) throw new Error("Select at least two numeric traits.");
  if (input.mode === "multi" && !environment) {
    throw new Error("A multi-environment correlation run requires an Environment column.");
  }

  return {
    base64_content: input.base64Content,
    file_type: input.fileType,
    genotype_column: genotype,
    rep_column: rep,
    environment_column: input.mode === "multi" ? environment : null,
    trait_columns: traits,
    method: input.method,
    mode: input.mode,
  };
}
