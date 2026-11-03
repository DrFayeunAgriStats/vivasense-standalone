import { describe, expect, it } from "vitest";
import { buildRelationshipCorrelationRequest } from "./relationshipCorrelationRequest";

const base = {
  base64Content: "ZGF0YQ==",
  fileType: "csv" as const,
  genotypeColumn: "Genotype",
  repColumn: "Rep",
  traitColumns: ["PlantHeight", "Yield"],
};

describe("buildRelationshipCorrelationRequest", () => {
  it("preserves a multi-environment declaration so the backend can suppress pooled rg", () => {
    expect(
      buildRelationshipCorrelationRequest({
        ...base,
        environmentColumn: "Environment",
        method: "pearson",
        mode: "multi",
      }),
    ).toMatchObject({
      genotype_column: "Genotype",
      rep_column: "Rep",
      environment_column: "Environment",
      trait_columns: ["PlantHeight", "Yield"],
      method: "pearson",
      mode: "multi",
    });
  });

  it("sends no environment column for a governed single-environment run", () => {
    expect(
      buildRelationshipCorrelationRequest({
        ...base,
        environmentColumn: "Environment",
        method: "spearman",
        mode: "single",
      }),
    ).toMatchObject({
      environment_column: null,
      method: "spearman",
      mode: "single",
    });
  });

  it("fails closed when multi-environment mode has no environment column", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        ...base,
        environmentColumn: null,
        method: "pearson",
        mode: "multi",
      }),
    ).toThrow(/requires an Environment column/i);
  });

  it("requires at least two traits", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        ...base,
        traitColumns: ["Yield"],
        environmentColumn: null,
        method: "pearson",
        mode: "single",
      }),
    ).toThrow(/at least two numeric traits/i);
  });
});
