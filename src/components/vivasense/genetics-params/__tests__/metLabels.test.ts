import {describe, expect, it} from "vitest";
import {anovaSourceLabel} from "../GeneticsResultsDashboard";
import {describeResultScale} from "../resultCounts";
import type {GeneticsResult} from "@/services/geneticsUploadApi";

describe("multi-environment results use correct experimental structure labels", () => {
  it("labels real Environment and interaction rows but preserves mapped one-factor labels", () => {
    expect(anovaSourceLabel("environment")).toBe("Environment");
    expect(anovaSourceLabel("genotype")).toBe("Genotype");
    expect(anovaSourceLabel("environment:genotype")).toBe("Environment × Genotype");
    expect(anovaSourceLabel("genotype:environment")).toBe("Environment × Genotype");
    expect(anovaSourceLabel("genotype", "Variety")).toBe("Variety");
  });

  it("reports 3 environments and 4 blocks PER environment, not only 4 replications", () => {
    const r = {
      grand_mean: 6,
      environment_mode: "multi_environment",
      n_genotypes: 4,
      n_environments: 3,
      n_reps: 4,
    } as GeneticsResult;
    const text = describeResultScale(r);
    expect(text).toContain("4 genotypes");
    expect(text).toContain("3 environments");
    expect(text).toContain("4 blocks per environment");
  });
});
