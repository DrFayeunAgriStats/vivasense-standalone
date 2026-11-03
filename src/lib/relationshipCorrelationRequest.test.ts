import { describe, expect, it } from "vitest";
import { buildRelationshipCorrelationRequest } from "./relationshipCorrelationRequest";
import {
  EMPTY_GENETIC_CONTROLS,
  GENETIC_DECLARATION_TEXT,
  GENETIC_DESIGN_OPTIONS,
  buildContextFields,
  geneticControlsAfterContextSwitch,
  geneticControlsComplete,
} from "./relationshipGeneticContract";

const confirmed = { declarationChecked: true, design: "rcbd" as const };

const geneticBase = {
  base64Content: "ZGF0YQ==",
  fileType: "csv" as const,
  analysisContext: "genetic" as const,
  geneticControls: confirmed,
  genotypeColumn: "Genotype",
  repColumn: "Rep",
  traitColumns: ["PlantHeight", "Yield"],
};

describe("General context", () => {
  it("sends general context, no confirmation, canonical design, method, alpha and variables", () => {
    expect(
      buildRelationshipCorrelationRequest({
        base64Content: "ZGF0YQ==",
        fileType: "csv",
        analysisContext: "general",
        geneticControls: confirmed, // stale genetic state must be ignored in General
        alpha: 0.01,
        genotypeColumn: "Fertilizer",
        repColumn: "Block",
        environmentColumn: "Location",
        traitColumns: ["SoilN", "Yield"],
        method: "spearman",
        mode: "multi",
      }),
    ).toEqual({
      base64_content: "ZGF0YQ==",
      file_type: "csv",
      analysis_context: "general",
      genetic_material_confirmed: false,
      design: "not_required",
      alpha: 0.01,
      genotype_column: null,
      rep_column: null,
      environment_column: null,
      trait_columns: ["SoilN", "Yield"],
      method: "spearman",
      mode: "single",
    });
  });

  it("defaults alpha to 0.05 and rejects values outside the 0.01/0.05/0.10 catalogue", () => {
    const base = {
      base64Content: "x", fileType: "csv" as const, analysisContext: "general" as const,
      geneticControls: EMPTY_GENETIC_CONTROLS, traitColumns: ["A", "B"], method: "pearson" as const,
      mode: "single" as const,
    };
    expect(buildRelationshipCorrelationRequest(base).alpha).toBe(0.05);
    expect(() =>
      buildRelationshipCorrelationRequest({ ...base, alpha: 0.02 as never }),
    ).toThrow(/0\.01, 0\.05 or 0\.10/);
  });
});

describe("Genetic context — fail closed", () => {
  it("cannot be built without the A1 declaration", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        ...geneticBase,
        geneticControls: { declarationChecked: false, design: "rcbd" },
        method: "pearson",
        mode: "single",
      }),
    ).toThrow(/confirmation that the entries are genetic material/i);
  });

  it("cannot be built without an explicitly selected design (A1b)", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        ...geneticBase,
        geneticControls: { declarationChecked: true, design: "" },
        method: "pearson",
        mode: "single",
      }),
    ).toThrow(/explicitly selected supported experimental design/i);
  });

  it("rejects a non-0.05 alpha", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({ ...geneticBase, alpha: 0.1, method: "pearson", mode: "single" }),
    ).toThrow(/0\.05 only/);
  });

  it("sends genetic context, genetic_material_confirmed=true and design rcbd when complete", () => {
    expect(
      buildRelationshipCorrelationRequest({ ...geneticBase, method: "pearson", mode: "single" }),
    ).toMatchObject({
      analysis_context: "genetic",
      genetic_material_confirmed: true,
      design: "rcbd",
      alpha: 0.05,
      genotype_column: "Genotype",
      rep_column: "Rep",
      environment_column: null,
    });
  });

  it("keeps the multi-environment path explicit (backend suppresses pooled rg)", () => {
    expect(
      buildRelationshipCorrelationRequest({
        ...geneticBase, environmentColumn: "Environment", method: "pearson", mode: "multi",
      }),
    ).toMatchObject({ mode: "multi", environment_column: "Environment", design: "rcbd" });
    expect(() =>
      buildRelationshipCorrelationRequest({ ...geneticBase, environmentColumn: null, method: "pearson", mode: "multi" }),
    ).toThrow(/requires an Environment column/i);
  });

  it("requires at least two traits in either context", () => {
    expect(() =>
      buildRelationshipCorrelationRequest({
        base64Content: "x", fileType: "csv", analysisContext: "general",
        geneticControls: EMPTY_GENETIC_CONTROLS, traitColumns: ["Yield"], method: "pearson", mode: "single",
      }),
    ).toThrow(/at least two numeric traits/i);
  });
});

describe("Context switching never carries a declaration forward", () => {
  it("clears declaration and design on every switch", () => {
    for (const next of ["general", "genetic"] as const) {
      const after = geneticControlsAfterContextSwitch(confirmed, next);
      expect(after).toEqual({ declarationChecked: false, design: "" });
      expect(geneticControlsComplete(after)).toBe(false);
      expect(() => buildContextFields("genetic", after)).toThrow();
    }
  });
});

describe("Controls contract", () => {
  it("uses the governed declaration wording and offers only RCBD as executable", () => {
    expect(GENETIC_DECLARATION_TEXT).toBe(
      "I confirm that the entries being compared represent genetic materials and that I intend to request genetically interpreted relationship statistics.",
    );
    expect(GENETIC_DESIGN_OPTIONS.filter((o) => o.executable).map((o) => o.value)).toEqual(["rcbd"]);
    expect(GENETIC_DESIGN_OPTIONS.filter((o) => !o.executable).every((o) => o.reason)).toBe(true);
    expect(EMPTY_GENETIC_CONTROLS).toEqual({ declarationChecked: false, design: "" });
  });
});
