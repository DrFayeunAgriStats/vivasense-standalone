import type { GovernedDesignType } from "@/components/vivasense/genetics-params/anovaDesigns";
import type { DatasetContext } from "@/types/geneticsUpload";

const builtinDesigns: Record<string, GovernedDesignType> = {
  crd: "crd", rcbd: "rcbd",
  "factorial-crd": "factorial_crd",
  "factorial-rcbd": "factorial_rcbd",
  "split-plot-rcbd": "split_plot_rcbd",
};

/** Presentation-only defaults at the start of a new analysis context.
 * A user-uploaded file never inherits a design from its filename or column names.
 */
export function initialAnovaSelections(context: Pick<DatasetContext, "sampleId" | "availableTraitColumns"> | null) {
  if (!context) return { design: "rcbd" as GovernedDesignType, traits: [] as string[] };
  const design: GovernedDesignType = context.sampleId && Object.prototype.hasOwnProperty.call(builtinDesigns, context.sampleId)
    ? builtinDesigns[context.sampleId] : "rcbd";
  return { design, traits: context.availableTraitColumns.length === 1 ? [context.availableTraitColumns[0]] : [] };
}
