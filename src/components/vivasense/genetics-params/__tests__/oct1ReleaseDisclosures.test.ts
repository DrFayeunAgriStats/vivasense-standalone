import { describe, expect, it } from "vitest";
import type { GeneticsResult } from "@/services/geneticsUploadApi";
import { describeCellSeparation } from "../governedFactorial";
import {
  SESSION_ONLY_PREVIEW_WARNING,
  factorialAllCellAlphaWarning,
  isSessionOnlyPreviewDesign,
  shouldHideFactorialAllCellGroups,
} from "../releaseDisclosures";

const result = (): GeneticsResult =>
  ({
    environment_mode: "single",
    n_genotypes: 2,
    n_reps: 3,
    n_environments: null,
    grand_mean: 10,
    variance_components: {},
    heritability: { h2_broad_sense: 0, interpretation_basis: "n/a" },
    genetic_parameters: { selection_intensity: 2.04 },
    interaction_separation: {
      genotype: ["A1", "A1", "A2", "A2"],
      factor: ["B1", "B2", "B1", "B2"],
      mean: [10, 12, 14, 16],
      se: [1, 1, 1, 1],
      group: ["b", "ab", "a", "a"],
      test: "Tukey HSD",
      alpha: 0.05,
      genotype_label: "FactorA",
      factor_label: "FactorB",
    },
  }) as unknown as GeneticsResult;

describe("OCT1 release disclosures", () => {
  it("limits the session-only Preview warning to factorial and split-plot designs", () => {
    expect(isSessionOnlyPreviewDesign("factorial_crd")).toBe(true);
    expect(isSessionOnlyPreviewDesign("factorial_rcbd")).toBe(true);
    expect(isSessionOnlyPreviewDesign("factorial")).toBe(true);
    expect(isSessionOnlyPreviewDesign("split_plot_rcbd")).toBe(true);
    expect(isSessionOnlyPreviewDesign("crd")).toBe(false);
    expect(isSessionOnlyPreviewDesign("rcbd")).toBe(false);
  });

  it("states the Preview limitation without claiming persistence or recoverability", () => {
    expect(SESSION_ONLY_PREVIEW_WARNING.startsWith("Preview:")).toBe(true);
    expect(SESSION_ONLY_PREVIEW_WARNING.toLowerCase()).toContain("session-only");
    expect(SESSION_ONLY_PREVIEW_WARNING.toLowerCase()).not.toContain("persistent");
    expect(SESSION_ONLY_PREVIEW_WARNING.toLowerCase()).not.toContain("recoverable");
  });

  it("hides legacy all-cell letters at non-0.05 inferential alpha", () => {
    const display = describeCellSeparation(result(), false, 0.01);
    expect(display).not.toBeNull();
    expect(display?.showGroups).toBe(false);
    expect(display?.rows.map((row) => row.mean)).toEqual([10, 12, 14, 16]);
    expect(display?.note).toBe(factorialAllCellAlphaWarning(0.01));
  });

  it("keeps the all-cell grouping column available at the 0.05 compatibility point", () => {
    const display = describeCellSeparation(result(), false, 0.05);
    expect(display?.showGroups).toBe(true);
    expect(display?.rows.map((row) => row.group)).toEqual(["b", "ab", "a", "a"]);
  });

  it("treats 0.01 and 0.10 as safeguard alphas, but not 0.05", () => {
    expect(shouldHideFactorialAllCellGroups(0.01)).toBe(true);
    expect(shouldHideFactorialAllCellGroups(0.05)).toBe(false);
    expect(shouldHideFactorialAllCellGroups(0.1)).toBe(true);
  });
});
