import { describe, expect, it } from "vitest";
import { experimentalResidualCV } from "./anovaPresentation";
import type { AnovaTable } from "@/services/geneticsUploadApi";
const table: AnovaTable = {
  source: ["genotype", "Residuals"], df: [3,16], ss: [9,4], ms: [3,0.25],
  f_value: [12,null], p_value: [0.001,null]
};
describe("experimental residual CV display", () => {
  it("uses the reported residual MSE and grand mean for governed CRD", () => {
    expect(experimentalResidualCV("crd", table, 5)).toBeCloseTo(10, 10);
  });
  it("uses the same well-defined residual error stratum for complete RCBD", () => {
    expect(experimentalResidualCV("rcbd", {...table, source:["rep", "Treatment", "Error"], ms:[1.5, 3, 0.25]}, 10)).toBeCloseTo(5, 10);
  });
  it("does not invent CV for split plot, missing MSE, ambiguous errors, or nonpositive means", () => {
    expect(experimentalResidualCV("split_plot_rcbd", table, 5)).toBeNull();
    expect(experimentalResidualCV("crd", {...table, source: ["Treatment","rep"]}, 5)).toBeNull();
    expect(experimentalResidualCV("crd", {...table, source: ["Error","Residual"]}, 5)).toBeNull();
    expect(experimentalResidualCV("crd", table, 0)).toBeNull();
    expect(experimentalResidualCV("crd", table, -2)).toBeNull();
  });
});
