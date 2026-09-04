/**
 * W1-INT-02 — experimental design roles must stay bound to the columns chosen.
 *
 * The reported failure: one uploaded dataset of 54 observations analysed first
 * as 18 treatments x 3 replications (treatment df 17, error df 36) and later as
 * 3 treatments x 18 observations (treatment df 2, error df 51), with an
 * identical total sum of squares. That signature is one dataset partitioned
 * under a different grouping factor — the replication column analysed as the
 * treatment factor.
 *
 * CRD requires only the `treatment` role, so the replication column is dropped
 * from both the request and (previously) from validation. Mapping Treatment to
 * the replication column therefore produced a silently valid analysis of a
 * model nobody chose. These tests pin the guard, and pin that changing the
 * inferential alpha cannot move any role.
 */

import { describe, it, expect } from "vitest";
import {
  type ColumnMapping,
  type GovernedDesignType,
  validateMapping,
  buildAnovaRequest,
  buildStructuralPreview,
} from "../anovaDesigns";

const TREATMENT = "Genotype";
const REP = "Rep";
const TRAITS = ["DTF_Days", "PHTF_cm"];
const ALPHAS = [0.05, 0.01, 0.1] as const;

const ctx = {
  base64Content: "Zm9v",
  fileType: "csv" as const,
  genotypeColumn: TREATMENT,
  repColumn: REP,
  environmentColumn: null,
  environmentFactorColumns: [],
  mode: "single" as const,
};

/** 54 rows: 18 treatment levels x 3 replication levels. */
const previewRows = Array.from({ length: 18 }, (_, g) =>
  Array.from({ length: 3 }, (_, r) => ({
    [TREATMENT]: `G${String(g + 1).padStart(2, "0")}`,
    [REP]: `R${r + 1}`,
    DTF_Days: 40 + g,
    PHTF_cm: 18 + g,
  }))
).flat();

const correctMapping: ColumnMapping = { treatment: TREATMENT, rep: REP };
const swappedMapping: ColumnMapping = { treatment: REP, rep: TREATMENT };
const collidingMapping: ColumnMapping = { treatment: REP, rep: REP };

describe("W1-INT-02 — treatment and replication roles are distinct", () => {
  it("refuses one column holding both the treatment and replication roles in CRD", () => {
    const issue = validateMapping("crd", collidingMapping, TRAITS);
    expect(issue).not.toBeNull();
    expect(issue!.message).toContain(REP);
    expect(issue!.roles).toEqual(["treatment", "rep"]);
  });

  it("refuses the same collision in RCBD", () => {
    const issue = validateMapping("rcbd", collidingMapping, TRAITS);
    expect(issue).not.toBeNull();
    expect(issue!.roles).toContain("treatment");
    expect(issue!.roles).toContain("rep");
  });

  it("fails visibly rather than silently reassigning either role", () => {
    const issue = validateMapping("crd", collidingMapping, TRAITS);
    // The message names the offending column and asks the user to restate the
    // design. Nothing in the mapping is rewritten.
    expect(issue!.message).toMatch(/cannot be the treatment factor and the replication factor/i);
    expect(collidingMapping.treatment).toBe(REP);
    expect(collidingMapping.rep).toBe(REP);
  });

  it("accepts a correct CRD mapping", () => {
    expect(validateMapping("crd", correctMapping, TRAITS)).toBeNull();
  });

  it("accepts a correct RCBD mapping", () => {
    expect(validateMapping("rcbd", correctMapping, TRAITS)).toBeNull();
  });

  it("does not count levels to decide which column is the treatment", () => {
    // A deliberate swap of two DISTINCT columns stays the user's decision: the
    // guard is about role identity, not about which column "looks like" a
    // treatment. Inferring roles from level counts is what this defect forbids.
    expect(validateMapping("crd", swappedMapping, TRAITS)).toBeNull();
  });
});

describe("W1-INT-02 — alpha cannot mutate design-role state", () => {
  it.each(ALPHAS)("builds identical role bindings at alpha %s", (alpha) => {
    const request = buildAnovaRequest({
      datasetContext: ctx,
      design: "crd",
      alpha,
      mapping: correctMapping,
      traits: TRAITS,
    });
    expect(request.genotype_column).toBe(TREATMENT);
    expect(request.treatment_column).toBe(TREATMENT);
    expect(request.trait_columns).toEqual(TRAITS);
    expect(request.design_type).toBe("crd");
    expect(request.alpha).toBe(alpha);
  });

  it("changes nothing but alpha across 0.05 -> 0.01 -> 0.10 -> 0.05", () => {
    const build = (alpha: (typeof ALPHAS)[number]) =>
      buildAnovaRequest({
        datasetContext: ctx,
        design: "crd",
        alpha,
        mapping: correctMapping,
        traits: TRAITS,
      });

    const sequence = [0.05, 0.01, 0.1, 0.05] as const;
    const withoutAlpha = sequence.map((a) => {
      const { alpha: _alpha, ...rest } = build(a);
      return JSON.stringify(rest);
    });

    for (const serialized of withoutAlpha) {
      expect(serialized).toBe(withoutAlpha[0]);
    }
    expect(sequence.map((a) => build(a).alpha)).toEqual([0.05, 0.01, 0.1, 0.05]);
  });

  it("keeps the replication role bound across alpha changes in RCBD", () => {
    const requests = ALPHAS.map((alpha) =>
      buildAnovaRequest({
        datasetContext: ctx,
        design: "rcbd",
        alpha,
        mapping: correctMapping,
        traits: TRAITS,
      })
    );
    for (const request of requests) {
      expect(request.genotype_column).toBe(TREATMENT);
      expect(request.rep_column).toBe(REP);
    }
  });
});

describe("W1-INT-02 — the resolved design context is representable before running", () => {
  it("states the design, the mapped columns and their level counts", () => {
    const preview = buildStructuralPreview("crd", correctMapping, 0.05, previewRows);
    expect(preview.designLabel).toContain("Completely Randomized");
    expect(preview.levelCounts.treatment).toBe(18);

    const asText = preview.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    expect(asText).toContain(TREATMENT);
    expect(asText).toContain("18 levels");
    expect(asText).toContain("Inferential α: 0.05");
  });

  it("makes a role swap visible in the design summary before analysis runs", () => {
    // The swap that caused the field failure is legible here: the treatment
    // role reports 3 levels, not 18.
    const preview = buildStructuralPreview("crd", swappedMapping, 0.05, previewRows);
    expect(preview.levelCounts.treatment).toBe(3);
    const asText = preview.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    expect(asText).toContain(`${REP} · 3 levels`);
  });

  it("reports the replication column and its block count for RCBD", () => {
    const preview = buildStructuralPreview("rcbd", correctMapping, 0.05, previewRows);
    expect(preview.levelCounts.treatment).toBe(18);
    expect(preview.levelCounts.rep).toBe(3);
    const asText = preview.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    expect(asText).toContain("3 blocks");
  });

  it.each(ALPHAS)("reports the alpha it was given (%s) and no other design change", (alpha) => {
    const preview = buildStructuralPreview("crd", correctMapping, alpha, previewRows);
    expect(preview.levelCounts.treatment).toBe(18);
    expect(preview.rows.at(-1)).toEqual({
      label: "Inferential α",
      value: alpha.toFixed(2),
    });
  });
});

describe("W1-INT-02 — designs without a treatment role are unaffected", () => {
  const factorialMapping: ColumnMapping = {
    treatment: REP,
    rep: REP,
    factor_a: "A",
    factor_b: "B",
    main_plot: "MP",
    sub_plot: "SP",
  };

  it.each<GovernedDesignType>(["factorial_crd", "factorial_rcbd", "split_plot_rcbd"])(
    "%s ignores the unused treatment role entirely",
    (design) => {
      // These designs do not use `treatment`, so a stale value left over from a
      // previous selection must neither block them nor reach the request.
      expect(validateMapping(design, factorialMapping, TRAITS)).toBeNull();
      const request = buildAnovaRequest({
        datasetContext: ctx,
        design,
        alpha: 0.05,
        mapping: factorialMapping,
        traits: TRAITS,
      });
      expect(request.treatment_column).toBeUndefined();
    }
  );
});
