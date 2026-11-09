import { describe, expect, it } from "vitest";
import { modelCVRows } from "../modelCVRows";
import type { GeneticsResult } from "@/services/geneticsUploadApi";

function result(ms: number | null, grandMean = 5): GeneticsResult {
  return {
    environment_mode: "single",
    n_environments: 1,
    grand_mean: grandMean,
    variance_components: {},
    heritability: {h2_broad_sense: 0, interpretation_basis: "not applicable"},
    genetic_parameters: {selection_intensity: 1.4},
    anova_table: {
      source: ["genotype", "Residuals"], df: [2, 10],
      ss: [10, 2.5], ms: [5, ms],
      f_value: [20, null], p_value: [0.001, null],
    },
  };
}

describe("model-specific CV disclosure", () => {
  it("reports factorial residual CV from ANOVA mean square, not total response SD", () => {
    const rows = modelCVRows(result(0.25), "factorial_crd", "single");
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toContain("Residual CV");
    expect(rows[0].percent).toBeCloseTo(10, 10);
  });

  it("reports both split-plot error strata without pooling", () => {
    const r = result(0.25);
    r.variance_components = {cv_A: 7.87, cv_B: 4.52};
    expect(modelCVRows(r, "split_plot_rcbd", "single")).toEqual([
      {label: "CV(A) · whole-plot", percent: 7.87, provenance: "Whole-plot error (Error A)"},
      {label: "CV(B) · subplot", percent: 4.52, provenance: "Subplot error (Error B)"},
    ]);
  });

  it("discloses combined-MET residual CV but does not duplicate single RCBD", () => {
    const r = result(0.25);
    expect(modelCVRows(r, "rcbd", "multi")[0].percent).toBe(10);
    expect(modelCVRows(r, "rcbd", "single")).toEqual([]);
  });

  it("omits invalid precision metrics instead of producing misleading numbers", () => {
    expect(modelCVRows(result(null), "factorial_rcbd", "single")).toEqual([]);
    expect(modelCVRows(result(-2), "factorial_rcbd", "single")).toEqual([]);
    expect(modelCVRows(result(0.25, 0), "factorial_rcbd", "single")).toEqual([]);
    expect(modelCVRows(result(0.25), "split_plot_rcbd", "single")).toEqual([]);
  });
});
