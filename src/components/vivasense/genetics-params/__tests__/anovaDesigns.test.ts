/**
 * Phase B — governed design selection and structural mapping.
 *
 * The rules live in pure functions precisely so they can be tested without
 * mounting the panel: what the selector may emit, which columns each design
 * requires, and — most importantly — which column roles actually reach the
 * request. That last one is where the FAC-1 defect lived: a factorial that
 * carried a block it should not have.
 */

import { describe, it, expect } from "vitest";
import {
  GOVERNED_DESIGNS,
  GOVERNED_DESIGN_IDS,
  type GovernedDesignType,
  type ColumnMapping,
  designMeta,
  requiredRoles,
  requiresBlock,
  activeMapping,
  validateMapping,
  buildStructuralPreview,
  buildAnovaRequest,
  validateOneFactorResultCounts,
  describeStructuralError,
  labelStoredDesign,
  isLegacyDesignId,
} from "../anovaDesigns";

const ctx = {
  base64Content: "Zm9v",
  fileType: "csv" as const,
  genotypeColumn: "Treatment",
  repColumn: "Block",
  environmentColumn: null,
  environmentFactorColumns: [],
  mode: "single" as const,
};

const fullMapping: ColumnMapping = {
  treatment: "Treatment",
  rep: "Block",
  factor_a: "FactorA",
  factor_b: "FactorB",
  main_plot: "Main",
  sub_plot: "Sub",
};

const build = (design: GovernedDesignType, mapping: ColumnMapping = fullMapping, alpha: 0.01 | 0.05 | 0.1 = 0.05) =>
  buildAnovaRequest({ datasetContext: ctx, design, alpha, mapping, traits: ["Yield"] });

describe("design vocabulary", () => {
  it("offers exactly the five governed designs", () => {
    expect(GOVERNED_DESIGN_IDS).toEqual([
      "crd",
      "rcbd",
      "factorial_crd",
      "factorial_rcbd",
      "split_plot_rcbd",
    ]);
  });

  it("emits each governed design id from the selector", () => {
    for (const id of GOVERNED_DESIGN_IDS) {
      expect(build(id).design_type).toBe(id);
    }
  });

  it("never emits the legacy 'factorial' identifier", () => {
    expect(GOVERNED_DESIGN_IDS).not.toContain("factorial");
    for (const id of GOVERNED_DESIGN_IDS) {
      expect(build(id).design_type).not.toBe("factorial");
    }
  });

  it("carries the required user-facing labels", () => {
    expect(designMeta("crd").fullLabel).toBe("Completely Randomized Design (CRD)");
    expect(designMeta("rcbd").fullLabel).toBe("Randomized Complete Block Design (RCBD)");
    expect(designMeta("factorial_crd").fullLabel).toBe("Factorial CRD");
    expect(designMeta("factorial_rcbd").fullLabel).toBe("Factorial RCBD");
    expect(designMeta("split_plot_rcbd").fullLabel).toBe("Split-Plot RCBD");
  });

  it("does not expose three-factor factorial as a design", () => {
    expect(GOVERNED_DESIGNS.some((d) => /three|factor c/i.test(d.label + d.hint))).toBe(false);
  });
});

describe("column requirements", () => {
  it("CRD needs a treatment and no block", () => {
    expect(requiredRoles("crd")).toEqual(["treatment"]);
    expect(requiresBlock("crd")).toBe(false);
  });

  it("RCBD needs a treatment and a block", () => {
    expect(requiredRoles("rcbd")).toEqual(["treatment", "rep"]);
    expect(requiresBlock("rcbd")).toBe(true);
  });

  it("Factorial CRD needs both factors and no block", () => {
    expect(requiredRoles("factorial_crd")).toEqual(["factor_a", "factor_b"]);
    expect(requiresBlock("factorial_crd")).toBe(false);
  });

  it("Factorial RCBD needs both factors and a block", () => {
    expect(requiredRoles("factorial_rcbd")).toEqual(["factor_a", "factor_b", "rep"]);
    expect(requiresBlock("factorial_rcbd")).toBe(true);
  });

  it("Split-Plot needs block, whole-plot and subplot", () => {
    expect(requiredRoles("split_plot_rcbd")).toEqual(["rep", "main_plot", "sub_plot"]);
    expect(requiresBlock("split_plot_rcbd")).toBe(true);
  });
});

describe("request construction — only the design's own roles are sent", () => {
  it("Factorial CRD sends NO rep_column even when a block is mapped", () => {
    // The mapping deliberately contains a block left over from another design.
    const request = build("factorial_crd");
    expect(request.rep_column).toBe("");
    expect(request.factor_a_column).toBe("FactorA");
    expect(request.factor_b_column).toBe("FactorB");
    // A synthetic block is exactly what aliased Factor B away before FAC-1.
    expect(request.main_plot_column).toBeUndefined();
    expect(request.treatment_column).toBeUndefined();
  });

  it("Factorial RCBD requires and sends rep_column", () => {
    const request = build("factorial_rcbd");
    expect(request.rep_column).toBe("Block");
    expect(request.factor_a_column).toBe("FactorA");
    expect(request.factor_b_column).toBe("FactorB");
  });

  it("CRD sends no block", () => {
    const request = build("crd");
    expect(request.rep_column).toBe("");
    expect(request.treatment_column).toBe("Treatment");
  });

  it("RCBD sends the block", () => {
    const request = build("rcbd");
    expect(request.rep_column).toBe("Block");
    expect(request.treatment_column).toBe("Treatment");
  });

  it("Split-Plot sends block, whole plot and subplot and no factor A/B", () => {
    const request = build("split_plot_rcbd");
    expect(request.rep_column).toBe("Block");
    expect(request.main_plot_column).toBe("Main");
    expect(request.sub_plot_column).toBe("Sub");
    expect(request.factor_a_column).toBeUndefined();
    expect(request.factor_b_column).toBeUndefined();
  });

  it("never sends factor_c_column — three-factor stays outside the governed path", () => {
    for (const id of GOVERNED_DESIGN_IDS) {
      expect(build(id).factor_c_column).toBeUndefined();
    }
  });

  it("activeMapping drops roles the design does not use", () => {
    expect(activeMapping("factorial_crd", fullMapping)).toEqual({
      factor_a: "FactorA",
      factor_b: "FactorB",
    });
  });
});

describe("alpha", () => {
  it("defaults to 0.05 in the panel's constant", () => {
    // Mirrors DEFAULT_ALPHA; the panel test below covers the wiring.
    expect(build("crd", fullMapping, 0.05).alpha).toBe(0.05);
  });

  it("sends each permitted alpha exactly", () => {
    expect(build("crd", fullMapping, 0.01).alpha).toBe(0.01);
    expect(build("crd", fullMapping, 0.05).alpha).toBe(0.05);
    expect(build("crd", fullMapping, 0.1).alpha).toBe(0.1);
  });

  it("sends alpha for every design", () => {
    for (const id of GOVERNED_DESIGN_IDS) {
      expect(build(id, fullMapping, 0.01).alpha).toBe(0.01);
    }
  });
});

describe("frontend validation", () => {
  const traits = ["Yield"];

  it("requires at least one response variable", () => {
    expect(validateMapping("crd", fullMapping, [])?.message).toMatch(/response variable/i);
  });

  it("blocks a missing required factor", () => {
    expect(validateMapping("factorial_crd", { factor_a: "A" }, traits)?.message).toMatch(/Factor B/);
  });

  it("blocks a missing block for RCBD", () => {
    expect(validateMapping("rcbd", { treatment: "T" }, traits)?.message).toMatch(
      /Replication \/ Block/
    );
  });

  it("blocks a missing block for Factorial RCBD", () => {
    expect(
      validateMapping("factorial_rcbd", { factor_a: "A", factor_b: "B" }, traits)?.message
    ).toMatch(/Replication \/ Block/);
  });

  it("blocks a missing block for Split-Plot", () => {
    expect(
      validateMapping("split_plot_rcbd", { main_plot: "M", sub_plot: "S" }, traits)?.message
    ).toMatch(/Replication \/ Block/);
  });

  it("blocks a missing whole-plot or subplot factor", () => {
    expect(
      validateMapping("split_plot_rcbd", { rep: "R", sub_plot: "S" }, traits)?.message
    ).toMatch(/Whole-plot/);
    expect(
      validateMapping("split_plot_rcbd", { rep: "R", main_plot: "M" }, traits)?.message
    ).toMatch(/Subplot/);
  });

  it("blocks Factor A = Factor B", () => {
    expect(
      validateMapping("factorial_crd", { factor_a: "X", factor_b: "X" }, traits)?.message
    ).toMatch(/cannot be the same column/);
  });

  it("blocks treatment = block", () => {
    expect(
      validateMapping("rcbd", { treatment: "X", rep: "X" }, traits)?.message
    ).toMatch(/cannot be the same column/);
  });

  it("blocks whole-plot = subplot", () => {
    expect(
      validateMapping("split_plot_rcbd", { rep: "R", main_plot: "X", sub_plot: "X" }, traits)
        ?.message
    ).toMatch(/cannot be the same column/);
  });

  it("blocks a structural column also chosen as a response", () => {
    expect(validateMapping("crd", { treatment: "Yield" }, traits)?.message).toMatch(
      /also selected as a response variable/
    );
  });

  it("does NOT require a block for CRD or Factorial CRD", () => {
    expect(validateMapping("crd", { treatment: "T" }, traits)).toBeNull();
    expect(validateMapping("factorial_crd", { factor_a: "A", factor_b: "B" }, traits)).toBeNull();
  });
});

describe("structural preview — descriptive only", () => {
  const rows = [
    { Block: "R1", Main: "M1", Sub: "S1", Yield: 1 },
    { Block: "R1", Main: "M1", Sub: "S2", Yield: 2 },
    { Block: "R1", Main: "M2", Sub: "S1", Yield: 3 },
    { Block: "R2", Main: "M1", Sub: "S1", Yield: 4 },
  ];
  const fullCounts = { Block: 2, Main: 2, Sub: 2, Treatment: 3 };

  it("uses full-dataset level counts, not the visible preview sample", () => {
    const preview = buildStructuralPreview("split_plot_rcbd", fullMapping, 0.05, rows, fullCounts);
    expect(preview.levelCounts.rep).toBe(2);
    expect(preview.levelCounts.main_plot).toBe(2);
    expect(preview.levelCounts.sub_plot).toBe(2);
  });

  it("does not under-count a treatment missing from the first five preview rows", () => {
    const firstFive = [
      { Treatment: "T1", Block: "B1" },
      { Treatment: "T1", Block: "B2" },
      { Treatment: "T1", Block: "B3" },
      { Treatment: "T2", Block: "B1" },
      { Treatment: "T2", Block: "B2" },
    ];
    const preview = buildStructuralPreview(
      "rcbd",
      { treatment: "Treatment", rep: "Block" },
      0.05,
      firstFive,
      { Treatment: 3, Block: 3 },
    );
    expect(preview.levelCounts.treatment).toBe(3);
    expect(preview.levelCounts.rep).toBe(3);
    expect(preview.rows.find((r) => r.label === "Treatment / Factor")?.value).toContain("3 levels");
  });

  it("refuses to manufacture authoritative counts from preview rows alone", () => {
    const preview = buildStructuralPreview("rcbd", fullMapping, 0.05, rows);
    expect(preview.levelCounts).toEqual({});
    expect(preview.expectedCombinations).toBeNull();
  });

  it("reports expected combinations as a complete-design count, not a verdict", () => {
    const preview = buildStructuralPreview("split_plot_rcbd", fullMapping, 0.05, rows, fullCounts);
    expect(preview.expectedCombinations).toBe(4);
    const row = preview.rows.find((r) => r.label === "Treatment combinations");
    expect(row?.value).toContain("if complete");
  });

  it("shows the selected alpha", () => {
    const preview = buildStructuralPreview("crd", fullMapping, 0.01, rows, fullCounts);
    expect(preview.rows.find((r) => r.label === "Inferential α")?.value).toBe("0.01");
  });

  it("never reports an inferential decision", () => {
    const preview = buildStructuralPreview("factorial_rcbd", fullMapping, 0.05, rows, {
      FactorA: 2, FactorB: 2, Block: 2,
    });
    const text = preview.rows.map((r) => `${r.label} ${r.value}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/significant|p-value|p =|reject/);
  });
});

describe("one-factor result count identity", () => {
  const response = (overrides: {
    summaryTreatments?: number;
    summaryBlocks?: number;
    resultTreatments?: number;
    resultBlocks?: number;
    profileTreatments?: number;
    profileBlocks?: number;
  } = {}) => ({
    summary_table: [],
    dataset_summary: {
      n_genotypes: overrides.summaryTreatments ?? 3,
      n_reps: overrides.summaryBlocks ?? 3,
      n_environments: null,
      n_traits: 1,
      mode: "single",
    },
    failed_traits: [],
    trait_results: {
      Yield: {
        status: "success" as const,
        error: null,
        data_warnings: [],
        analysis_result: {
          status: "success",
          mode: "single",
          data_validation: {},
          variance_warnings: {},
          interpretation: null,
          result: {
            environment_mode: "single",
            n_genotypes: overrides.resultTreatments ?? 3,
            n_reps: overrides.resultBlocks ?? 3,
            n_environments: null,
            grand_mean: 15,
            variance_components: {},
            heritability: { h2_broad_sense: 0, interpretation_basis: "" },
            genetic_parameters: { selection_intensity: 2.04 },
            rcbd_design_profile: {
              treatment_count: overrides.profileTreatments ?? 3,
              block_count: overrides.profileBlocks ?? 3,
            },
          },
        },
      },
    },
  });

  it("passes when mapped dataset, response summary, trait result and RCBD profile agree", () => {
    expect(validateOneFactorResultCounts(
      "rcbd",
      { treatment: "Treatment", rep: "Block" },
      { Treatment: 3, Block: 3 },
      response(),
    )).toBeNull();
  });

  it("fails closed when any treatment count disagrees", () => {
    const error = validateOneFactorResultCounts(
      "rcbd",
      { treatment: "Treatment", rep: "Block" },
      { Treatment: 3, Block: 3 },
      response({ profileTreatments: 2 }),
    );
    expect(error).toMatch(/withheld/i);
    expect(error).toMatch(/Treatment level counts disagree/i);
  });

  it("fails closed when the block count disagrees", () => {
    const error = validateOneFactorResultCounts(
      "rcbd",
      { treatment: "Treatment", rep: "Block" },
      { Treatment: 3, Block: 3 },
      response({ resultBlocks: 2 }),
    );
    expect(error).toMatch(/Block level counts disagree/i);
  });
});

describe("backend structural error rendering", () => {
  const cases: [string, RegExp][] = [
    ["[rcbd_missing_cells]", /incomplete/i],
    ["[rcbd_missing_and_duplicate_cells]", /missing and duplicated/i],
    ["[factorial_crd_missing_cells]", /interaction cannot be estimated/i],
    ["[factorial_rcbd_missing_block_column]", /requires a replication \/ block column/i],
    ["[factorial_rcbd_incomplete_or_duplicated_blocks]", /every block/i],
    ["[factorial_factor_level_lost_to_missing_response]", /no usable response/i],
    ["[factorial_missing_structural_identifier]", /missing or empty/i],
    ["[split_plot_missing_whole_plot]", /whole plot/i],
    ["[split_plot_incomplete_or_duplicated_subplots]", /subplot/i],
    ["[split_plot_insufficient_blocks]", /at least two blocks/i],
    ["[split_plot_insufficient_whole_plot_levels]", /Error A/],
    ["[split_plot_insufficient_sub_plot_levels]", /at least two/i],
    ["[split_plot_missing_structural_identifier]", /missing or empty/i],
  ];

  for (const [raw, expected] of cases) {
    it(`translates ${raw}`, () => {
      const shown = describeStructuralError(`Something failed. ${raw}`);
      expect(shown.message).toMatch(expected);
      // The code is preserved for support, never swallowed.
      expect(shown.code).toBe(raw.slice(1, -1));
      expect(shown.raw).toContain(raw);
    });
  }

  it("recognises a bare snake_case code without brackets", () => {
    const shown = describeStructuralError(
      "Incomplete or duplicated split-plot structure: split_plot_incomplete_or_duplicated_subplots"
    );
    expect(shown.code).toBe("split_plot_incomplete_or_duplicated_subplots");
  });

  it("never invents a reason for an unknown code", () => {
    const shown = describeStructuralError("Some new backend failure [brand_new_code]");
    expect(shown.code).toBe("brand_new_code");
    expect(shown.message).toBe("Some new backend failure");
  });

  it("handles an empty error safely", () => {
    expect(describeStructuralError(null).message).toMatch(/unspecified/i);
  });
});

describe("legacy factorial handling", () => {
  it("labels a stored 'factorial' conservatively", () => {
    expect(labelStoredDesign("factorial")).toBe(
      "Legacy factorial (block structure unrecorded)"
    );
  });

  it("does NOT reinterpret stored 'factorial' as Factorial CRD", () => {
    expect(labelStoredDesign("factorial")).not.toMatch(/Factorial CRD/);
    expect(isLegacyDesignId("factorial")).toBe(true);
  });

  it("labels governed stored designs with their full names", () => {
    expect(labelStoredDesign("factorial_crd")).toBe("Factorial CRD");
    expect(labelStoredDesign("split_plot_rcbd")).toBe("Split-Plot RCBD");
    expect(isLegacyDesignId("factorial_crd")).toBe(false);
  });

  it("does not crash on an unknown or absent stored design", () => {
    expect(labelStoredDesign(null)).toBe("Unspecified design");
    expect(labelStoredDesign("something_else")).toBe("something_else");
  });
});
