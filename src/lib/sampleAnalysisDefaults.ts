import type { GovernedDesignType } from "@/components/vivasense/genetics-params/anovaDesigns";
import type { DatasetContext } from "@/types/geneticsUpload";

const builtinDesigns: Record<string, GovernedDesignType> = {
  crd: "crd", rcbd: "rcbd",
  "factorial-crd": "factorial_crd",
  "factorial-rcbd": "factorial_rcbd",
  "split-plot-rcbd": "split_plot_rcbd",
  "bioassay": "factorial_rcbd",
};

/** Presentation-only defaults at the start of a new analysis context.
 * A user-uploaded file never inherits a design from its filename or column names.
 */
/**
 * Built-in teaching fixtures alone may pre-populate treatment-factor roles.
 * Never infer mappings from names for arbitrary uploaded researcher datasets.
 * Every offered default must actually exist in the uploaded file.
 */
export function initialSampleRoleMappings(context: Pick<DatasetContext, "sampleId" | "columns" | "availableColumns"> | null) {
  const blank = { factorA: "", factorB: "", mainPlot: "", subPlot: "" };
  if (!context?.sampleId) return blank;
  const columns = new Set(context.columns ?? context.availableColumns ?? []);
  const has = (...names: string[]) => names.every(name => columns.has(name));
  if (["factorial-crd", "factorial-rcbd"].includes(context.sampleId) && has("Nitrogen", "Variety")) {
    return { ...blank, factorA: "Nitrogen", factorB: "Variety" };
  }
  if (context.sampleId === "split-plot-rcbd" && has("Nitrogen", "Variety")) {
    return { ...blank, mainPlot: "Nitrogen", subPlot: "Variety" };
  }
  if (context.sampleId === "bioassay" && has("Treatment", "Dose")) {
    return { ...blank, factorA: "Treatment", factorB: "Dose" };
  }
  return blank;
}

export function initialAnovaSelections(context: Pick<DatasetContext, "sampleId" | "availableTraitColumns"> | null) {
  if (!context) return { design: "rcbd" as GovernedDesignType, traits: [] as string[] };
  const design: GovernedDesignType = context.sampleId && Object.prototype.hasOwnProperty.call(builtinDesigns, context.sampleId)
    ? builtinDesigns[context.sampleId] : "rcbd";
  return { design, traits: context.availableTraitColumns.length === 1 ? [context.availableTraitColumns[0]] : [] };
}
