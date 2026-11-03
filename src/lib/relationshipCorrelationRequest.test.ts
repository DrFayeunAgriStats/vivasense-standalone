import { describe, expect, it } from "vitest";
import { buildRelationshipCorrelationRequest } from "./relationshipCorrelationRequest";

const geneticBase = {
  base64Content: "ZGF0YQ==",
  fileType: "csv" as const,
  analysisContext: "genetic" as const,
  geneticMaterialConfirmed: true,
  genotypeColumn: "Genotype",
  repColumn: "Rep",
  traitColumns: ["PlantHeight", "Yield"],
};

describe("buildRelationshipCorrelationRequest", () => {
  it("builds General Correlation without genotype, rep or genetic confirmation", () => {
    expect(
      buildRelationshipCorrelationRequest({
        base64Content: "ZGF0YQ==",
        fileType: "csv",
        analysisContext: "general",
        geneticMaterialConfirmed: false,
        genotypeColumn: "Fertilizer",
        repColumn: "Block",
        environmentColumn: "Location",
        traitColumns: ["SoilN", "Yield"],
        method: "pearson",
        mode: "multi",
      }),
    ).toEqual({
      base64_content: "ZGF0YQ==",
      file_type: "csv",
      analysis_context: "general",
      genetic_material_confirmed: false,
      genotype_column: null,
      rep_column: null,
      environment_column: null,
      trait_columns: ["SoilN", "Yield"],
      method: "pearson",
      mode: "single",
    });
  });

  it("preserves a confirmed multi-environment genetic declaration", () => {
    expect(
      buildRelationshipCorrelationRequest({
        ...geneticBase,
        environmentColumn: "Environment",
        method: "pearson",
        mode: "multi",
      }),
    ).toMatchObject({
      analysis_context: "genetic",
      genetic_material_confirmed: true,
      genotype_column: "Genotype",
      rep_column: "Rep",
      environment_column: "Environment",
      method: "pearson",
      mode: "multi",
    });
  });

  it("refuses genetic mode when the entries are not confirmed genetic material", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        ...geneticBase,
        geneticMaterialConfirmed: false,
        genotypeColumn: "Fertilizer",
        method: "pearson",
        mode: "single",
      }),
    ).toThrow(/confirmation that the entries are genetic material/i);
  });

  it("sends no environment column for a confirmed single-environment genetic run", () => {
    expect(
      buildRelationshipCorrelationRequest({
        ...geneticBase,
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

  it("fails closed when multi-environment genetic mode has no environment column", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        ...geneticBase,
        environmentColumn: null,
        method: "pearson",
        mode: "multi",
      }),
    ).toThrow(/requires an Environment column/i);
  });

  it("requires at least two traits in either context", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        base64Content: "ZGF0YQ==",
        fileType: "csv",
        analysisContext: "general",
        geneticMaterialConfirmed: false,
        traitColumns: ["Yield"],
        method: "pearson",
        mode: "single",
      }),
    ).toThrow(/at least two numeric traits/i);
  });
});
