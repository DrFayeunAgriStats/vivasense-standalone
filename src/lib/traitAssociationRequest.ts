/**
 * REL-OPEN-01 — Trait Association reports ONLY the model-based genotypic
 * correlation (rg), a genetically interpreted statistic. The request therefore
 * always needs the A1 declaration and an explicitly selected RCBD design; the
 * backend refuses (422) otherwise. The deprecated analysis_unit /
 * environment_context / gxe_significant fields are no longer sent (the backend
 * ignores them and derives the environment context from the data).
 */
import { buildContextFields, type GeneticControlsState } from "./relationshipGeneticContract";

export interface GovernedTraitAssociationRequest {
  dataset_token: string;
  trait_columns: string[];
  analysis_context: "genetic";
  genetic_material_confirmed: true;
  design: "rcbd";
  alpha: 0.05;
}

export function buildTraitAssociationRequest(
  datasetToken: string | null,
  traits: string[],
  controls: GeneticControlsState,
): GovernedTraitAssociationRequest {
  if (!datasetToken) throw new Error("Dataset required.");
  if (traits.length < 2) throw new Error("Pick at least 2 traits.");
  const ctx = buildContextFields("genetic", controls, 0.05);   // throws unless A1 + A1b complete
  return {
    dataset_token: datasetToken,
    trait_columns: traits,
    analysis_context: "genetic",
    genetic_material_confirmed: true,
    design: ctx.design as "rcbd",
    alpha: 0.05,
  };
}
