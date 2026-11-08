import { describe, expect, it } from "vitest";
import { resolveMetrics } from "./metricsConfig";

describe("analysis metric labels", () => {
  it("shows treatments for ANOVA even when the historical field is called n_genotypes", () => {
    const items = resolveMetrics("anova", {n_genotypes:4,n_reps:3}, 5);
    expect(items).toContainEqual({label:"Treatment levels",value:"4",mono:true});
    expect(items.map(item => item.label)).not.toContain("Genotypes");
  });
  it("retains genotype terminology for genetics analyses", () => {
    expect(resolveMetrics("genetic_parameters",{n_genotypes:4},5).map(item=>item.label))
      .toContain("Genotypes");
  });
});
