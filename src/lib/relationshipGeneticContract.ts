/**
 * REL-OPEN-01 — frozen frontend contract for genetically interpreted
 * relationship statistics (A1 declaration + A1b explicit design).
 *
 * The backend refuses genetic statistics (422) unless the request carries
 * analysis_context="genetic", genetic_material_confirmed=true and an
 * explicitly declared design="rcbd". General correlation needs none of this
 * and always sends the canonical design token "not_required".
 *
 * Nothing here is inferred from column names, labels or data layout, and no
 * genetic control is ever pre-selected.
 */

export type RelationshipAnalysisContext = "general" | "genetic";
export type GeneticDesign = "rcbd";
export type RelationshipAlpha = 0.01 | 0.05 | 0.1;

/** Canonical persisted design value for General (requested_design is NOT NULL). */
export const GENERAL_DESIGN_TOKEN = "not_required" as const;

/** Live analysis_runs CHECK: alpha IN (0.01, 0.05, 0.10). Genetic: 0.05 only. */
export const SUPPORTED_ALPHAS: readonly RelationshipAlpha[] = [0.01, 0.05, 0.1];
export const GENETIC_ALPHA: RelationshipAlpha = 0.05;

/** A1 — exact declaration wording (checkbox, unchecked by default). */
export const GENETIC_DECLARATION_TEXT =
  "I confirm that the entries being compared represent genetic materials and that I intend to request genetically interpreted relationship statistics.";

/** A1b — explicit design choice. Only RCBD is executable; others are shown unavailable. */
export const GENETIC_DESIGN_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  executable: boolean;
  reason?: string;
}> = [
  { value: "rcbd", label: "RCBD — Randomized Complete Block Design", executable: true },
  {
    value: "crd",
    label: "CRD — Completely Randomized Design",
    executable: false,
    reason: "Not available: the validated genetic model is a single-environment RCBD model.",
  },
  {
    value: "met",
    label: "Multi-environment trial",
    executable: false,
    reason:
      "Not available: a pooled genetic correlation across environments needs a genotype × environment model that is not implemented.",
  },
];

/** Genetic-only form state. Reset whenever the user leaves the genetic context. */
export interface GeneticControlsState {
  declarationChecked: boolean;
  design: GeneticDesign | "";
}

export const EMPTY_GENETIC_CONTROLS: GeneticControlsState = Object.freeze({
  declarationChecked: false,
  design: "",
}) as GeneticControlsState;

/** Switching context ALWAYS discards genetic-only state, so an earlier
 *  declaration can never silently authorize a later genetic request. */
export function geneticControlsAfterContextSwitch(
  _previous: GeneticControlsState,
  _next: RelationshipAnalysisContext,
): GeneticControlsState {
  return { ...EMPTY_GENETIC_CONTROLS };
}

export function geneticControlsComplete(state: GeneticControlsState): boolean {
  return state.declarationChecked === true && state.design === "rcbd";
}

export interface ContextRequestFields {
  analysis_context: RelationshipAnalysisContext;
  genetic_material_confirmed: boolean;
  design: GeneticDesign | typeof GENERAL_DESIGN_TOKEN;
  alpha: RelationshipAlpha;
}

/**
 * The context fields of every Relationship request. Throws (never sends) when
 * a genetic request is incomplete.
 */
export function buildContextFields(
  context: RelationshipAnalysisContext,
  genetic: GeneticControlsState,
  alpha: RelationshipAlpha = 0.05,
): ContextRequestFields {
  if (!SUPPORTED_ALPHAS.includes(alpha)) {
    throw new Error("Significance level must be 0.01, 0.05 or 0.10.");
  }
  if (context === "general") {
    return {
      analysis_context: "general",
      genetic_material_confirmed: false,
      design: GENERAL_DESIGN_TOKEN,
      alpha,
    };
  }
  if (genetic.declarationChecked !== true) {
    throw new Error(
      "Breeding & Genetic mode requires confirmation that the entries are genetic material.",
    );
  }
  if (genetic.design !== "rcbd") {
    throw new Error(
      "Breeding & Genetic mode requires an explicitly selected supported experimental design (RCBD).",
    );
  }
  if (alpha !== GENETIC_ALPHA) {
    throw new Error("Breeding & Genetic mode reports inference at α = 0.05 only.");
  }
  return { analysis_context: "genetic", genetic_material_confirmed: true, design: "rcbd", alpha };
}
