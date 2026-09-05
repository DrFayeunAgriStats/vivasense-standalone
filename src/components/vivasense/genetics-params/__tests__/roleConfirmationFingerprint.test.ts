/**
 * W1-UI-04 — experimental role confirmation fingerprint.
 *
 * `canonicalRoleConfirmationFingerprint` is deliberately narrower than
 * W1-INT-06's `canonicalAnalysisFingerprint`: it answers "has the researcher
 * confirmed THIS experimental structure", not "does a result still describe
 * the current scientific state". It therefore takes only dataset identity +
 * design + the design's active structural-role mapping, and has no way to
 * even accept alpha, trait selection or response semantics as input — the
 * exclusion is structural, not a comparison someone could forget to skip.
 */
import { describe, it, expect } from "vitest";
import { canonicalRoleConfirmationFingerprint } from "../roleConfirmationFingerprint";

const base = {
  datasetToken: "ds-1",
  design: "rcbd" as const,
  mapping: { treatment: "Genotype", rep: "Rep" },
};

describe("W1-UI-04 — canonicalRoleConfirmationFingerprint", () => {
  it("A — same dataset + design + role mapping produces the same fingerprint", () => {
    const fp1 = canonicalRoleConfirmationFingerprint(base);
    const fp2 = canonicalRoleConfirmationFingerprint({
      datasetToken: "ds-1",
      design: "rcbd",
      mapping: { treatment: "Genotype", rep: "Rep" },
    });
    expect(fp1).toBe(fp2);
  });

  it("B — dataset identity change alters the fingerprint", () => {
    const fp1 = canonicalRoleConfirmationFingerprint(base);
    const fp2 = canonicalRoleConfirmationFingerprint({ ...base, datasetToken: "ds-2" });
    expect(fp1).not.toBe(fp2);
  });

  it("C — design change alters the fingerprint", () => {
    const fp1 = canonicalRoleConfirmationFingerprint(base);
    const fp2 = canonicalRoleConfirmationFingerprint({ ...base, design: "crd" });
    expect(fp1).not.toBe(fp2);
  });

  it("D — treatment column change alters the fingerprint", () => {
    const fp1 = canonicalRoleConfirmationFingerprint(base);
    const fp2 = canonicalRoleConfirmationFingerprint({
      ...base,
      mapping: { ...base.mapping, treatment: "Entry" },
    });
    expect(fp1).not.toBe(fp2);
  });

  it("E — block/rep column change alters the fingerprint", () => {
    const fp1 = canonicalRoleConfirmationFingerprint(base);
    const fp2 = canonicalRoleConfirmationFingerprint({
      ...base,
      mapping: { ...base.mapping, rep: "Location" },
    });
    expect(fp1).not.toBe(fp2);
  });

  it("F — Factor A change alters the fingerprint", () => {
    const factorial = { datasetToken: "ds-1", design: "factorial_crd" as const, mapping: { factor_a: "Variety", factor_b: "Nitrogen" } };
    const fp1 = canonicalRoleConfirmationFingerprint(factorial);
    const fp2 = canonicalRoleConfirmationFingerprint({
      ...factorial,
      mapping: { ...factorial.mapping, factor_a: "Cultivar" },
    });
    expect(fp1).not.toBe(fp2);
  });

  it("G — Factor B change alters the fingerprint", () => {
    const factorial = { datasetToken: "ds-1", design: "factorial_crd" as const, mapping: { factor_a: "Variety", factor_b: "Nitrogen" } };
    const fp1 = canonicalRoleConfirmationFingerprint(factorial);
    const fp2 = canonicalRoleConfirmationFingerprint({
      ...factorial,
      mapping: { ...factorial.mapping, factor_b: "Phosphorus" },
    });
    expect(fp1).not.toBe(fp2);
  });

  it("H — whole-plot (main_plot) change alters the fingerprint", () => {
    const splitPlot = {
      datasetToken: "ds-1",
      design: "split_plot_rcbd" as const,
      mapping: { rep: "Block", main_plot: "Irrigation", sub_plot: "Variety" },
    };
    const fp1 = canonicalRoleConfirmationFingerprint(splitPlot);
    const fp2 = canonicalRoleConfirmationFingerprint({
      ...splitPlot,
      mapping: { ...splitPlot.mapping, main_plot: "Tillage" },
    });
    expect(fp1).not.toBe(fp2);
  });

  it("I — subplot change alters the fingerprint", () => {
    const splitPlot = {
      datasetToken: "ds-1",
      design: "split_plot_rcbd" as const,
      mapping: { rep: "Block", main_plot: "Irrigation", sub_plot: "Variety" },
    };
    const fp1 = canonicalRoleConfirmationFingerprint(splitPlot);
    const fp2 = canonicalRoleConfirmationFingerprint({
      ...splitPlot,
      mapping: { ...splitPlot.mapping, sub_plot: "Cultivar" },
    });
    expect(fp1).not.toBe(fp2);
  });

  it("a structural role left over from a different design is inert (uses activeMapping)", () => {
    // Mirrors the W1-INT-07 defect class: a value sitting in a role the
    // current design does not use must never affect anything, including this
    // fingerprint.
    const fp1 = canonicalRoleConfirmationFingerprint({
      datasetToken: "ds-1",
      design: "crd",
      mapping: { treatment: "Genotype" },
    });
    const fp2 = canonicalRoleConfirmationFingerprint({
      datasetToken: "ds-1",
      design: "crd",
      mapping: { treatment: "Genotype", rep: "Batch", factor_a: "Leftover" },
    });
    expect(fp1).toBe(fp2);
  });
});
