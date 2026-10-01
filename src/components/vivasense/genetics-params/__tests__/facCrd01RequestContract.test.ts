/**
 * FAC-CRD-01 — factorial requests send Factor A as the legacy genotype alias.
 *
 * For factorial designs the backend treats `factor_a_column` as authoritative
 * and `genotype_column` only as a compatibility alias, and rejects a request
 * whose `genotype_column` names a different column. The upload's auto-detected
 * genotype column must therefore never reach a factorial request.
 */

import { describe, it, expect } from "vitest";
import { type ColumnMapping, buildAnovaRequest } from "../anovaDesigns";

const ctx = {
  base64Content: "Zm9v",
  fileType: "csv" as const,
  // Auto-detected by the upload — deliberately NOT Factor A.
  genotypeColumn: "Variety",
  repColumn: "Block",
  environmentColumn: null,
  environmentFactorColumns: [],
  mode: "single" as const,
};

const mapping: ColumnMapping = {
  treatment: "Variety",
  rep: "Block",
  factor_a: "Nitrogen",
  factor_b: "Spacing",
  main_plot: "Irrigation",
  sub_plot: "Nitrogen",
};

describe("FAC-CRD-01 — factorial genotype alias", () => {
  it.each(["factorial_crd", "factorial_rcbd"] as const)(
    "%s sends Factor A as genotype_column, never the auto-detected column",
    (design) => {
      const request = buildAnovaRequest({
        datasetContext: ctx,
        design,
        alpha: 0.05,
        mapping,
        traits: ["Yield"],
      });
      expect(request.factor_a_column).toBe("Nitrogen");
      expect(request.genotype_column).toBe("Nitrogen");
      expect(request.genotype_column).not.toBe("Variety");
      expect(request.factor_b_column).toBe("Spacing");
      expect(request.treatment_column).toBeUndefined();
      expect(request.module).toBe("anova");
      expect(request.design_type).toBe(design);
    }
  );

  it.each([0.01, 0.05, 0.1] as const)("keeps the alias bound to Factor A at alpha %s", (alpha) => {
    const request = buildAnovaRequest({
      datasetContext: ctx,
      design: "factorial_crd",
      alpha,
      mapping,
      traits: ["Yield"],
    });
    expect(request.genotype_column).toBe("Nitrogen");
    expect(request.rep_column).toBe("");
  });
});

describe("FAC-CRD-01 — non-factorial designs are unchanged", () => {
  it.each(["crd", "rcbd"] as const)("%s sends the mapped treatment as genotype_column", (design) => {
    const request = buildAnovaRequest({
      datasetContext: ctx,
      design,
      alpha: 0.05,
      mapping: { ...mapping, treatment: "Cultivar" },
      traits: ["Yield"],
    });
    expect(request.genotype_column).toBe("Cultivar");
    expect(request.treatment_column).toBe("Cultivar");
    expect(request.factor_a_column).toBeUndefined();
    expect(request.module).toBe("anova");
  });

  it("rcbd keeps the block and crd drops it", () => {
    const build = (design: "crd" | "rcbd") =>
      buildAnovaRequest({ datasetContext: ctx, design, alpha: 0.05, mapping, traits: ["Yield"] });
    expect(build("rcbd").rep_column).toBe("Block");
    expect(build("crd").rep_column).toBe("");
  });

  it("split_plot_rcbd sends no legacy genotype alias and keeps explicit plot roles", () => {
    const request = buildAnovaRequest({
      datasetContext: ctx,
      design: "split_plot_rcbd",
      alpha: 0.05,
      mapping,
      traits: ["Yield"],
    });
    expect(request.genotype_column).toBe("");
    expect(request.genotype_column).not.toBe(request.main_plot_column);
    expect(request.genotype_column).not.toBe(request.sub_plot_column);
    expect(request.main_plot_column).toBe("Irrigation");
    expect(request.sub_plot_column).toBe("Nitrogen");
    expect(request.rep_column).toBe("Block");
    expect(request.factor_a_column).toBeUndefined();
    expect(request.module).toBe("anova");
  });
});
