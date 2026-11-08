import { describe, expect, it } from "vitest";
import { GENERAL_CORRELATION_ENDPOINT, GENERAL_SUPPORTED_ALPHAS, buildGeneralCorrelationRequest } from "./generalCorrelationContract";

const base = { base64Content: "ZGF0YQ==", fileType: "csv" as const, traitColumns: ["Yield", "Height"], method: "pearson" as const };

describe("General correlation request contract", () => {
  it("targets the General endpoint", () => {
    expect(GENERAL_CORRELATION_ENDPOINT).toBe("/genetics/correlation/general");
  });

  it("sends exactly base64_content, file_type, trait_columns, method and alpha — no genetic or structural field", () => {
    const req = buildGeneralCorrelationRequest({ ...base, method: "spearman", alpha: 0.1 });
    expect(req).toEqual({ base64_content: "ZGF0YQ==", file_type: "csv", trait_columns: ["Yield", "Height"], method: "spearman", alpha: 0.1 });
    for (const forbidden of ["genotype_column", "rep_column", "environment_column", "design", "analysis_context", "genetic_material_confirmed", "mode"]) {
      expect(req).not.toHaveProperty(forbidden);
    }
  });

  it("defaults alpha to 0.05 and accepts only 0.01 / 0.05 / 0.10", () => {
    expect(buildGeneralCorrelationRequest(base).alpha).toBe(0.05);
    expect(GENERAL_SUPPORTED_ALPHAS).toEqual([0.01, 0.05, 0.1]);
    expect(() => buildGeneralCorrelationRequest({ ...base, alpha: 0.02 as never })).toThrow(/0\.01, 0\.05 or 0\.10/);
  });

  it("requires two distinct variables, a valid method and a dataset", () => {
    expect(() => buildGeneralCorrelationRequest({ ...base, traitColumns: ["Yield", "Yield "] })).toThrow(/two numeric variables/);
    expect(() => buildGeneralCorrelationRequest({ ...base, method: "kendall" as never })).toThrow(/Pearson or Spearman/);
    expect(() => buildGeneralCorrelationRequest({ ...base, base64Content: "" })).toThrow(/Upload a dataset/);
  });
});
