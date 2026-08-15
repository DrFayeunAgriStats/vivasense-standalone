import type {
  DatasetContext,
  GeneticParametersTraitResult,
  GeneticParametersRequest,
  RegisterDatasetRequest,
} from "@/types/geneticsUpload";

export type VarianceComponentsMode = "single" | "multi";
export type VarianceComponentsDesign = "crd" | "rcbd";

function formatNumber(value: unknown, digits = 4): string {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? String(value) : parsed.toFixed(digits);
}

interface MappingSelection {
  mode: VarianceComponentsMode;
  design: VarianceComponentsDesign;
  genotypeColumn: string;
  repColumn: string;
  traitColumns: string[];
}

export function buildVarianceComponentRows(
  trait: GeneticParametersTraitResult,
  mode: VarianceComponentsMode,
): { label: string; value: string }[] {
  const variance = trait.variance_components ?? {};
  const heritability = trait.heritability ?? {};
  return [
    { label: "Grand Mean", value: formatNumber(trait.grand_mean) },
    { label: "σ²g (Genotypic Variance)", value: formatNumber(variance.sigma2_genotype) },
    ...(mode === "multi"
      ? [{ label: "σ²ge (Genotype × Environment Variance)", value: formatNumber(variance.sigma2_ge) }]
      : []),
    { label: "σ²e (Error Variance)", value: formatNumber(variance.sigma2_error) },
    {
      label: mode === "multi" ? "Entry-mean Phenotypic Variance" : "σ²p (Phenotypic Variance)",
      value: formatNumber(variance.sigma2_phenotypic),
    },
    {
      label: mode === "multi"
        ? "H² (Across-environment broad-sense heritability of genotype means)"
        : "H² (Broad-sense Heritability)",
      value: formatNumber(heritability.h2_broad_sense),
    },
    { label: "GCV% (Genotypic CV)", value: formatNumber(trait.gcv, 2) },
    { label: "PCV% (Phenotypic CV)", value: formatNumber(trait.pcv, 2) },
    { label: "GA (Genetic Advance)", value: formatNumber(trait.ga) },
    { label: "GAM% (GA as % of Mean)", value: formatNumber(trait.gam, 2) },
  ];
}

export function formatVarianceComponentsError(
  message: string,
  mode: VarianceComponentsMode,
): string {
  return mode === "multi"
    ? `This analysis requires a complete, balanced multi-environment trial. ${message}`
    : message;
}

export function buildVarianceComponentsRequests(
  dataset: DatasetContext,
  selection: MappingSelection,
): { registration: RegisterDatasetRequest; analysis: Omit<GeneticParametersRequest, "dataset_token"> } {
  const effectiveDesign: VarianceComponentsDesign = selection.mode === "multi" ? "rcbd" : selection.design;
  const effectiveRep = effectiveDesign === "rcbd" ? selection.repColumn : null;
  const environmentColumn = selection.mode === "multi" ? dataset.environmentColumn : null;
  const environmentFactorColumns =
    selection.mode === "multi" && !environmentColumn
      ? dataset.environmentFactorColumns ?? []
      : [];

  return {
    registration: {
      base64_content: dataset.base64Content,
      file_type: dataset.fileType,
      genotype_column: selection.genotypeColumn,
      rep_column: effectiveRep,
      environment_column: environmentColumn,
      environment_factor_columns: environmentFactorColumns,
      design_type: effectiveDesign,
      mode: selection.mode,
      random_environment: false,
      selection_intensity: 0.2,
    },
    analysis: {
      genotype_column: selection.genotypeColumn,
      rep_column: effectiveRep,
      design_type: effectiveDesign,
      trait_columns: selection.traitColumns,
      mode: selection.mode,
    },
  };
}
