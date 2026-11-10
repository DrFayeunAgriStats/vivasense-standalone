import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GxeProfile } from "@/services/geneticsUploadApi";

const source = readFileSync(resolve(process.cwd(), "src/components/vivasense/genetics-params/AnovaModulePanel.tsx"), "utf8");

const governed: GxeProfile = {
  inferential_alpha: 0.05,
  gxe_f: 84.04,
  gxe_p: 0.0001,
  decision: "significant",
  interaction_governs: true,
  environment_genotype_means: [
    { environment: "Akure", genotype: "G1", mean: 6.14, n: 3 },
  ],
  crossover_top_rank_change: true,
  means_provenance: "Arithmetic cell means",
  within_environment_inference: "Not performed",
  genotype_test_denominator: "Residual",
};

describe("G×E governing-results screen contract", () => {
  it("types selected alpha, decision, cell means and crossover without inventing tests", () => {
    expect(governed.decision).toBe("significant");
    expect(governed.environment_genotype_means[0].n).toBe(3);
    expect(governed).not.toHaveProperty("within_environment_tukey_letters");
  });

  it("shows the profile from each successful trait, not the uploaded sample filename", () => {
    expect(source).toContain("entry.analysis_result?.result?.gxe_profile");
    expect(source).toContain("gxe.environment_genotype_means.map");
    expect(source).toContain("Pooled genotype Tukey letters are withheld");
  });

  it("distinguishes descriptive crossover and avoids random environment claims", () => {
    expect(source).toContain("This is not a separate significance test.");
    expect(source).toContain("fixed-environment combined ANOVA");
    expect(source).toContain("Random-environment mixed-model inference");
  });
});
