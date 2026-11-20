/**
 * Result identity for the live ANOVA & Mean Separation panel.
 *
 * A displayed result must describe the run that produced it, not whatever the
 * setup controls currently show. Before this module the panel rendered
 * `designMeta(design)` from the live selector, so completing an RCBD run and
 * then clicking "CRD" relabelled the RCBD result as CRD and let its report be
 * downloaded under a CRD filename.
 *
 * The rule enforced here:
 *   - every completed run carries the setup it was submitted with;
 *   - the setup is reduced to a stable key (dataset, design, active mappings,
 *     response variables, inferential alpha, environment mode);
 *   - a result (or error) whose key differs from the current setup is stale and
 *     must not be shown or exported.
 */
import type { DatasetContext } from "@/types/geneticsUpload";
import type { AnovaAlpha } from "@/services/geneticsUploadApi";
import { activeMapping, type ColumnMapping, type GovernedDesignType } from "./anovaDesigns";

export interface AnovaRunSetup {
  design: GovernedDesignType;
  alpha: AnovaAlpha;
  mode: "single" | "multi";
  /** Only the roles the design uses, so a hidden leftover column cannot alter identity. */
  mapping: ColumnMapping;
  /** Response variables in selection order (order is preserved for display). */
  traits: string[];
  datasetName: string;
  datasetToken: string | null;
}

export function buildAnovaRunSetup(input: {
  design: GovernedDesignType;
  alpha: AnovaAlpha;
  mapping: ColumnMapping;
  traits: string[];
  datasetContext: Pick<DatasetContext, "mode" | "file" | "datasetToken">;
}): AnovaRunSetup {
  return {
    design: input.design,
    alpha: input.alpha,
    mode: input.datasetContext.mode,
    mapping: activeMapping(input.design, input.mapping),
    traits: [...input.traits],
    datasetName: input.datasetContext.file.name,
    datasetToken: input.datasetContext.datasetToken ?? null,
  };
}

/**
 * Stable identity of a setup. Response-variable order does not change the
 * analysis, so traits are sorted; mapping keys are sorted for the same reason.
 */
export function anovaRunSetupKey(setup: AnovaRunSetup): string {
  const mapping = Object.keys(setup.mapping)
    .sort()
    .map((role) => [role, setup.mapping[role as keyof ColumnMapping] ?? ""]);
  return JSON.stringify({
    design: setup.design,
    alpha: setup.alpha,
    mode: setup.mode,
    mapping,
    traits: [...setup.traits].sort(),
    dataset: [setup.datasetName, setup.datasetToken],
  });
}

/**
 * Word report filename for a completed run. Derived from the run's own design,
 * never from the live selector. Persistent single-environment RCBD runs keep
 * their existing `rcbd` name.
 */
export function anovaReportFilename(
  setup: Pick<AnovaRunSetup, "design">,
  date: Date = new Date(),
): string {
  return `VivaSense_ANOVA_${setup.design}_${date.toISOString().slice(0, 10)}.docx`;
}
