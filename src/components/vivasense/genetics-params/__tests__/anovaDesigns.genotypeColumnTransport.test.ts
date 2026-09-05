/**
 * W1-INT-07 — genotype_column transport regression.
 *
 * `buildAnovaRequest`'s treatment expression used to be:
 *
 *   const treatment = active.treatment ?? ctx.genotypeColumn ?? "";
 *
 * `requiredRoles("factorial_crd"|"factorial_rcbd"|"split_plot_rcbd")` does not
 * include "treatment", so `activeMapping` never sets `active.treatment` for
 * those designs -- the `ctx.genotypeColumn` fallback was therefore always
 * live for them, and always fired, regardless of what the researcher actually
 * selected for Factor A / Factor B / the plot roles.
 *
 * The backend's own factorial precedence rule
 * (`multitrait_upload_routes.py`, `effective_genotype_col`) prefers a
 * non-empty `genotype_column` over `factor_a_column` whenever one is present.
 * Because the frontend's generic upload-preview step always supplies a
 * non-empty `genotypeColumn` (its own "Treatment/Factor Column" selector has
 * no way to be left unset before "Confirm Mapping" unlocks), that leftover
 * value silently became the backend's actual first factor -- reproduced live
 * for Factorial CRD (W1-INT-06/07): a request declaring Factor A = "FactorA"
 * executed with Factor A actually bound to the generic-preview's "Batch"
 * column, while the UI still labelled the result "FactorA".
 *
 * The fix drops the `ctx.genotypeColumn` fallback entirely:
 *
 *   const treatment = active.treatment ?? "";
 *
 * CRD and RCBD are unaffected: "treatment" IS a required, validated role for
 * both, so `active.treatment` is always defined by the time this line runs
 * for any dispatchable request -- the removed fallback was already dead code
 * for them. Cases C and D below are the load-bearing regression proof of
 * that claim, not incidental coverage.
 */
import { describe, it, expect } from "vitest";
import { buildAnovaRequest } from "../anovaDesigns";

// Deliberately distinct from every explicit role selected below, and
// deliberately non-empty -- this is what the generic upload-preview step's
// mandatory "Treatment/Factor Column" selector actually supplies once a
// dataset clears "Confirm Mapping". If it ever leaks into a request for a
// design that doesn't use it as a role, these tests fail.
const GENERIC_PREVIEW_COLUMN = "Batch";

const baseDatasetContext = {
  base64Content: "AAAA",
  fileType: "csv" as const,
  genotypeColumn: GENERIC_PREVIEW_COLUMN,
  repColumn: GENERIC_PREVIEW_COLUMN,
  environmentColumn: null,
  mode: "single" as const,
};

describe("W1-INT-07 — genotype_column transport", () => {
  it("A — Factorial CRD: genotype_column is empty; Factor A/B carry the explicit roles", () => {
    const request = buildAnovaRequest({
      datasetContext: baseDatasetContext,
      design: "factorial_crd",
      alpha: 0.05,
      mapping: { factor_a: "FactorA", factor_b: "FactorB" },
      traits: ["Yield"],
      responseSemantics: {},
    });
    expect(request.genotype_column).toBe("");
    expect(request.factor_a_column).toBe("FactorA");
    expect(request.factor_b_column).toBe("FactorB");
  });

  it("B — Factorial RCBD: genotype_column is empty; Factor A/B/Rep carry the explicit roles", () => {
    const request = buildAnovaRequest({
      datasetContext: baseDatasetContext,
      design: "factorial_rcbd",
      alpha: 0.05,
      mapping: { factor_a: "FactorA", factor_b: "FactorB", rep: "Rep" },
      traits: ["Yield"],
      responseSemantics: {},
    });
    expect(request.genotype_column).toBe("");
    expect(request.factor_a_column).toBe("FactorA");
    expect(request.factor_b_column).toBe("FactorB");
    expect(request.rep_column).toBe("Rep");
  });

  it("C — CRD (load-bearing regression control): explicit treatment remains authoritative", () => {
    const request = buildAnovaRequest({
      datasetContext: baseDatasetContext,
      design: "crd",
      alpha: 0.05,
      mapping: { treatment: "Genotype" },
      traits: ["Yield"],
      responseSemantics: {},
    });
    expect(request.genotype_column).toBe("Genotype");
  });

  it("D — RCBD (load-bearing regression control): explicit treatment and block remain authoritative", () => {
    const request = buildAnovaRequest({
      datasetContext: baseDatasetContext,
      design: "rcbd",
      alpha: 0.05,
      mapping: { treatment: "Genotype", rep: "Rep" },
      traits: ["Yield"],
      responseSemantics: {},
    });
    expect(request.genotype_column).toBe("Genotype");
    expect(request.rep_column).toBe("Rep");
  });

  it("E — Split-Plot RCBD: genotype_column is empty; Rep/Whole-plot/Subplot carry the explicit roles", () => {
    const request = buildAnovaRequest({
      datasetContext: baseDatasetContext,
      design: "split_plot_rcbd",
      alpha: 0.05,
      mapping: { rep: "Rep", main_plot: "WholePlot", sub_plot: "SubPlot" },
      traits: ["Yield"],
      responseSemantics: {},
    });
    expect(request.genotype_column).toBe("");
    expect(request.rep_column).toBe("Rep");
    expect(request.main_plot_column).toBe("WholePlot");
    expect(request.sub_plot_column).toBe("SubPlot");
  });
});
