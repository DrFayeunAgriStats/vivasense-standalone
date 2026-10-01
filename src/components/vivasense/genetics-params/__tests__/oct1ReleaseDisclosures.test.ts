import { describe, expect, it } from "vitest";
import type { GeneticsResult } from "@/services/geneticsUploadApi";
import { describeCellSeparation } from "../governedFactorial";
import {
  SESSION_ONLY_PREVIEW_WARNING,
  factorialAllCellAlphaWarning,
  isSessionOnlyPreviewDesign,
  isSessionOnlyPreviewWarning,
  shouldHideFactorialAllCellGroups,
} from "../releaseDisclosures";

/** `null` omits `alpha` from the payload entirely. */
const result = (payloadAlpha: number | null): GeneticsResult =>
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
      ...(payloadAlpha === null ? {} : { alpha: payloadAlpha }),
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

  it("recognises the backend's Preview wording so the disclosure is shown once", () => {
    const backendWording =
      "Preview: this analysis is session-only. Download your report before leaving.";
    expect(isSessionOnlyPreviewWarning(backendWording)).toBe(true);
    expect(isSessionOnlyPreviewWarning(SESSION_ONLY_PREVIEW_WARNING)).toBe(true);
    expect(isSessionOnlyPreviewWarning("Unbalanced design: 2 missing cells.")).toBe(false);
  });
});

describe("OCT1 all-cell Tukey payload-consistency guard", () => {
  it.each([0.01, 0.05, 0.1])(
    "shows letters when selected alpha %s matches the payload alpha",
    (alpha) => {
      const display = describeCellSeparation(result(alpha), false, alpha);
      expect(display?.showGroups).toBe(true);
      expect(display?.rows.map((row) => row.group)).toEqual(["b", "ab", "a", "a"]);
      expect(display?.note).not.toMatch(/hidden/i);
    }
  );

  it("hides letters with a warning when the payload alpha differs from the selected alpha", () => {
    const display = describeCellSeparation(result(0.05), false, 0.01);
    expect(display?.showGroups).toBe(false);
    expect(display?.note).toBe(factorialAllCellAlphaWarning(0.01, 0.05));
    expect(display?.note).toContain("0.05");
    expect(display?.note).toContain("0.01");
  });

  it("fails safe when the payload does not state its alpha", () => {
    const display = describeCellSeparation(result(null), false, 0.05);
    expect(display?.showGroups).toBe(false);
    expect(display?.note).toBe(factorialAllCellAlphaWarning(0.05, null));
  });

  it("keeps treatment-combination means visible when letters are hidden", () => {
    const display = describeCellSeparation(result(0.05), false, 0.1);
    expect(display?.showGroups).toBe(false);
    expect(display?.rows.map((row) => row.mean)).toEqual([10, 12, 14, 16]);
  });

  it("keeps the all-cell table supplementary when the interaction governs", () => {
    const display = describeCellSeparation(result(0.01), true, 0.01);
    expect(display?.supplementary).toBe(true);
    expect(display?.showGroups).toBe(true);
    expect(display?.note).toMatch(/simple-effects families above are the authoritative/);
  });

  it("compares alphas with a floating-point tolerance", () => {
    expect(shouldHideFactorialAllCellGroups(0.1, 0.1 + 1e-12)).toBe(false);
    expect(shouldHideFactorialAllCellGroups(0.1, 0.30000000000000004 - 0.2)).toBe(false);
    expect(shouldHideFactorialAllCellGroups(0.01, 0.05)).toBe(true);
    expect(shouldHideFactorialAllCellGroups(0.05, null)).toBe(true);
    expect(shouldHideFactorialAllCellGroups(0.05, Number.NaN)).toBe(true);
  });
});
