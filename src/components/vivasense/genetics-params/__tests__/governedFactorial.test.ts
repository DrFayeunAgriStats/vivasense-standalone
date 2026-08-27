/**
 * Phase D — governed factorial interpretation.
 *
 * The centre of gravity is the interaction-first hierarchy. Under a significant
 * A × B there is no single "effect of Factor A" to report, so any flat claim
 * that Factor A affected the response is wrong rather than merely incomplete.
 * The matrix below asserts that across every combination of outcomes.
 */

import { describe, it, expect } from "vitest";
import type { GeneticsResult, GovernedDecision } from "@/services/geneticsUploadApi";
import {
  isGovernedFactorial,
  readFactorialProfile,
  buildFactorialSummary,
  readDecisions,
  describeHierarchy,
  readSimpleEffects,
  describeMarginalSeparation,
  describeCellSeparation,
  readInteractionPlot,
  hasThreeFactorOutput,
} from "../governedFactorial";

const PROFILE = {
  design: "factorial_crd",
  factor_a: "FactorA",
  factor_b: "FactorB",
  factor_a_levels: ["A1", "A2"],
  factor_b_levels: ["B1", "B2"],
  treatment_combinations: 4,
  replications: 3,
  model_formula: "response ~ A * B",
  balanced_complete_required: true,
};

/**
 * The REAL shape the deployed backend returns for a factorial RCBD — verified
 * against production. Note it carries neither `blocks` nor `block_factor`: the
 * block count has to come from `replications`, and the block's column name from
 * the user's own mapping. Hard-coding those keys would have produced a panel
 * that silently lost its block row against the live engine.
 */
const RCBD_PROFILE = {
  ...PROFILE,
  design: "factorial_rcbd",
  model_formula: "response ~ block + A * B",
  replications: 3,
};

const dec = (significant: boolean, p = 0.01, alpha = 0.05): GovernedDecision => ({
  estimable: true,
  significant,
  p_value: p,
  alpha,
  rule: "p_value <= alpha",
});

const result = (over: Partial<GeneticsResult> = {}): GeneticsResult =>
  ({
    environment_mode: "single",
    n_genotypes: 2,
    n_reps: 3,
    n_environments: null,
    grand_mean: 100,
    variance_components: {},
    heritability: { h2_broad_sense: 0, interpretation_basis: "x" },
    genetic_parameters: { selection_intensity: 2.04 },
    factorial_profile: PROFILE,
    factor_a_decision: dec(true),
    factor_b_decision: dec(true),
    interaction_decision: dec(false, 0.4),
    ...over,
  }) as unknown as GeneticsResult;

describe("governed factorial detection", () => {
  it("recognises a governed factorial CRD", () => {
    expect(isGovernedFactorial(result(), "factorial_crd")).toBe(true);
  });

  it("recognises a governed factorial RCBD", () => {
    expect(isGovernedFactorial(result({ factorial_profile: RCBD_PROFILE }), "factorial_rcbd")).toBe(true);
  });

  it("rejects an empty {} profile from jsonlite", () => {
    expect(isGovernedFactorial(result({ factorial_profile: {} }), "factorial_crd")).toBe(false);
  });

  it("rejects empty {} decisions", () => {
    expect(
      isGovernedFactorial(result({ interaction_decision: {} as GovernedDecision }), "factorial_crd")
    ).toBe(false);
  });

  it("does not infer governance from Tukey output, interaction means or design label", () => {
    const noProfile = result({
      factorial_profile: null,
      interaction_separation: { genotype: ["A1"], factor: ["B1"], mean: [1], group: ["a"] },
      mean_separation: { genotype: ["A1"], mean: [1], se: [null], group: ["a"], test: "Tukey HSD", alpha: 0.05 },
      design: "factorial_crd",
    });
    expect(isGovernedFactorial(noProfile, "factorial_crd")).toBe(false);
  });

  it("does not claim factorial governance for one-factor or split-plot designs", () => {
    expect(isGovernedFactorial(result(), "crd")).toBe(false);
    expect(isGovernedFactorial(result(), "rcbd")).toBe(false);
    expect(isGovernedFactorial(result(), "split_plot_rcbd")).toBe(false);
  });
});

describe("factorial CRD design structure", () => {
  const info = readFactorialProfile(result(), "factorial_crd")!;

  it("reads names and levels from the profile", () => {
    expect(info.factorA).toBe("FactorA");
    expect(info.factorB).toBe("FactorB");
    expect(info.factorALevels).toEqual(["A1", "A2"]);
    expect(info.treatmentCombinations).toBe(4);
  });

  it("has NO block term", () => {
    expect(info.hasBlockTerm).toBe(false);
    expect(info.blockFactor).toBeNull();
    expect(info.blocks).toBeNull();
  });

  it("never describes a synthetic blocking factor — the FAC-1 guard", () => {
    const text = buildFactorialSummary(info, 0.05)
      .map((r) => `${r.label} ${r.value} ${r.note ?? ""}`)
      .join(" ");
    expect(text).toMatch(/no blocking term is fitted/i);
    expect(text).not.toMatch(/Replication \/ block factor/);
    expect(text).not.toMatch(/\bBlocks\b/);
  });

  it("shows α and the A × B model", () => {
    const rows = buildFactorialSummary(info, 0.1);
    expect(rows.find((r) => r.label === "Inferential α")?.value).toBe("0.10");
    expect(rows.find((r) => r.label === "Model")?.value).toContain("A * B");
  });
});

describe("factorial RCBD design structure", () => {
  const info = readFactorialProfile(
    result({ factorial_profile: RCBD_PROFILE }), "factorial_rcbd", { rep: "Block" }
  )!;

  it("shows the block as a design term", () => {
    expect(info.hasBlockTerm).toBe(true);
    expect(info.blockFactor).toBe("Block");
    expect(info.blocks).toBe(3);
  });

  it("marks the block as design structure, not a treatment", () => {
    const row = buildFactorialSummary(info, 0.05).find((r) => r.label === "Replication / block factor");
    expect(row?.note).toMatch(/not a treatment being compared/i);
  });

  it("frames the model as block + A × B", () => {
    const row = buildFactorialSummary(info, 0.05).find((r) => r.label === "Model");
    expect(row?.value).toContain("block");
  });

  it("uses an explicit block_factor key when a future payload provides one", () => {
    const i = readFactorialProfile(
      result({ factorial_profile: { ...RCBD_PROFILE, block_factor: "Rep", blocks: 5 } }),
      "factorial_rcbd",
      { rep: "Block" }
    )!;
    expect(i.blockFactor).toBe("Rep");
    expect(i.blocks).toBe(5);
  });

  it("never shows a block for a factorial CRD, even if one is mapped", () => {
    const i = readFactorialProfile(result(), "factorial_crd", { rep: "Block" })!;
    expect(i.blockFactor).toBeNull();
    expect(i.blocks).toBeNull();
    expect(i.hasBlockTerm).toBe(false);
  });
});

describe("FV1-2 guard — design info survives a withheld post-hoc", () => {
  it("renders full factor information when Factor A is nonsignificant and its separation is absent", () => {
    const r = result({
      factor_a_decision: dec(false, 0.6),
      factor_a_mean_separation_status: {
        status: "not_run_omnibus_not_significant",
        method: "Tukey HSD",
        alpha: 0.05,
        message: "withheld",
      },
      mean_separation: undefined,
    });
    const info = readFactorialProfile(r, "factorial_crd")!;
    // Structure comes from the profile, never from the suppressed object.
    expect(info.factorA).toBe("FactorA");
    expect(info.factorALevels).toEqual(["A1", "A2"]);
    expect(info.factorB).toBe("FactorB");
    expect(info.treatmentCombinations).toBe(4);
    const rows = buildFactorialSummary(info, 0.05);
    expect(rows.find((x) => x.label === "Factor A")?.value).toContain("FactorA");
  });
});

describe("decision rendering", () => {
  it("reads all three decisions from the backend objects", () => {
    const info = readFactorialProfile(result(), "factorial_crd")!;
    const decisions = readDecisions(result(), info);
    expect(decisions.map((d) => d.key)).toEqual(["a", "b", "ab"]);
    expect(decisions[2].term).toBe("FactorA × FactorB");
  });

  it("renders the decision rule in readable form", () => {
    const info = readFactorialProfile(result(), "factorial_crd")!;
    expect(readDecisions(result(), info)[0].rule).toBe("p ≤ α");
  });

  it("follows the backend for p between .01 and .05", () => {
    const r = result({ factor_a_decision: dec(false, 0.039, 0.01) });
    const info = readFactorialProfile(r, "factorial_crd")!;
    const a = readDecisions(r, info).find((d) => d.key === "a")!;
    // A UI recomputing against 0.05 would call this significant.
    expect(a.significant).toBe(false);
    expect(a.alpha).toBe(0.01);
  });

  it("follows the backend for p between .05 and .10", () => {
    const sig = result({ factor_a_decision: dec(true, 0.077, 0.1) });
    const ns = result({ factor_a_decision: dec(false, 0.077, 0.05) });
    const info = readFactorialProfile(sig, "factorial_crd")!;
    expect(readDecisions(sig, info).find((d) => d.key === "a")!.significant).toBe(true);
    expect(readDecisions(ns, info).find((d) => d.key === "a")!.significant).toBe(false);
  });
});

// ── The hierarchy matrix ─────────────────────────────────────────────────────

const MATRIX: [string, boolean, boolean, boolean][] = [
  ["A sig, B ns, AB ns", true, false, false],
  ["A ns, B sig, AB ns", false, true, false],
  ["A sig, B sig, AB ns", true, true, false],
  ["A ns, B ns, AB ns", false, false, false],
  ["AB sig, A sig, B sig", true, true, true],
  ["AB sig, A sig, B ns", true, false, true],
  ["AB sig, A ns, B sig", false, true, true],
  ["AB sig, A ns, B ns", false, false, true],
];

describe("interaction hierarchy matrix", () => {
  for (const [label, aSig, bSig, abSig] of MATRIX) {
    describe(label, () => {
      const r = result({
        factor_a_decision: dec(aSig),
        factor_b_decision: dec(bSig),
        interaction_decision: dec(abSig, abSig ? 0.001 : 0.4),
      });
      const info = readFactorialProfile(r, "factorial_crd")!;
      const h = describeHierarchy(readDecisions(r, info), info)!;
      const allText = `${h.headline} ${h.marginalGuidance} ${h.separationGuidance}`;

      it("reports the interaction state correctly", () => {
        expect(h.interactionSignificant).toBe(abSig);
      });

      if (abSig) {
        it("leads with the interaction as the primary result", () => {
          expect(h.headline).toMatch(/interaction was significant/i);
          expect(h.headline).toMatch(/primary inferential result/i);
          expect(h.headline).toMatch(/depends on the level of/i);
        });

        it("marks marginal main effects as secondary", () => {
          expect(h.marginalGuidance).toMatch(/secondary/i);
          expect(h.marginalGuidance).toMatch(/must not be read as unconditional effects/i);
        });

        it("makes simple effects govern", () => {
          expect(h.simpleEffectsGovern).toBe(true);
          expect(h.separationGuidance).toMatch(/simple effects/i);
          expect(h.separationGuidance).toMatch(/pooled residual error term/i);
        });

        it("never makes a flat unconditional main-effect claim", () => {
          expect(allText).not.toMatch(/FactorA significantly affected/i);
          expect(allText).not.toMatch(/FactorB significantly affected/i);
          expect(allText).not.toMatch(/\bsignificantly affected\b/i);
        });
      } else {
        it("states the interaction is not supported at the selected α", () => {
          expect(h.headline).toMatch(/interaction was not significant/i);
          expect(h.headline).toMatch(/not supported at the selected α/i);
        });

        it("allows marginal main effects to be interpreted", () => {
          expect(h.simpleEffectsGovern).toBe(false);
          expect(h.headline).toMatch(/interpretable on its own/i);
          expect(h.separationGuidance).toMatch(/Marginal mean separation/i);
        });

        it("still avoids flat 'significantly affected' phrasing", () => {
          expect(allText).not.toMatch(/\bsignificantly affected\b/i);
        });
      }
    });
  }
});

// ── Simple effects ───────────────────────────────────────────────────────────

const SIMPLE = {
  moving_a_within_b: [
    {
      fixed_factor: "FactorB",
      fixed_level: "B1",
      moving_factor: "FactorA",
      alpha: 0.05,
      comparison_family: "FactorA compared within FactorB = B1",
      multiplicity: "Tukey HSD controlled within this family; families are not pooled.",
      scale_label: "Cell arithmetic mean",
      status: "success",
      message: "ok",
      levels: ["A2", "A1"],
      mean: [102.7, 100.2],
      group: ["a", "b"],
    },
  ],
  moving_b_within_a: [
    {
      fixed_factor: "FactorA",
      fixed_level: "A1",
      moving_factor: "FactorB",
      alpha: 0.05,
      comparison_family: "FactorB compared within FactorA = A1",
      scale_label: "Cell arithmetic mean",
      status: "success",
      message: "ok",
      levels: ["B2", "B1"],
      mean: [103.1, 100.2],
      group: ["a", "b"],
    },
  ],
};

describe("simple effects", () => {
  const r = result({
    interaction_decision: dec(true, 0.0001),
    simple_effects: SIMPLE,
    simple_effects_status: {
      status: "success",
      alpha: 0.05,
      message: "The interaction was significant, so simple effects are the governing comparison.",
      error_term: "Pooled residual mean square and residual degrees of freedom from the full factorial model.",
      multiplicity: "Tukey HSD controlled within each simple-effect family; families are not pooled.",
    },
  });

  it("reads both directions", () => {
    const s = readSimpleEffects(r)!;
    expect(s.aWithinB).toHaveLength(1);
    expect(s.bWithinA).toHaveLength(1);
  });

  it("identifies the conditioning level and the effect being tested", () => {
    const f = readSimpleEffects(r)!.aWithinB[0];
    expect(f.fixedFactor).toBe("FactorB");
    expect(f.fixedLevel).toBe("B1");
    expect(f.movingFactor).toBe("FactorA");
    expect(f.family).toBe("FactorA compared within FactorB = B1");
  });

  it("states the full-model pooled error term", () => {
    expect(readSimpleEffects(r)!.errorTerm).toMatch(/Pooled residual mean square/i);
  });

  it("keeps families unpooled", () => {
    expect(readSimpleEffects(r)!.multiplicity).toMatch(/families are not pooled/i);
  });

  it("shows grouping letters only for successful families", () => {
    const f = readSimpleEffects(r)!.aWithinB[0];
    expect(f.showLetters).toBe(true);
    expect(f.groups).toEqual(["a", "b"]);
  });

  it("returns nothing for an empty {} simple_effects", () => {
    expect(readSimpleEffects(result({ simple_effects: {} }))).toBeNull();
  });
});

// ── Marginal gates and supplementary cells ───────────────────────────────────

describe("marginal post-hoc gating", () => {
  const sep = {
    genotype: ["A2", "A1"], mean: [106.2, 101.7], se: [null, null],
    group: ["a", "b"], test: "Tukey HSD", alpha: 0.05,
    scale_label: "Marginal arithmetic mean",
  };
  const okStatus = { status: "success", method: "Tukey HSD", alpha: 0.05, message: "ok",
    means_provenance: "Marginal arithmetic mean of FactorA, averaged over the other factor." };

  it("is authoritative when the interaction is NOT significant and the gate opened", () => {
    const d = describeMarginalSeparation("FactorA", okStatus, sep, false)!;
    expect(d.tone).toBe("success");
    expect(d.authoritative).toBe(true);
    expect(d.showLetters).toBe(true);
  });

  it("is NOT authoritative and shows no letters when the interaction governs", () => {
    const d = describeMarginalSeparation("FactorA", okStatus, sep, true)!;
    expect(d.tone).toBe("success");
    expect(d.authoritative).toBe(false);
    expect(d.showLetters).toBe(false);
  });

  it("withholds separation when the marginal omnibus did not meet α", () => {
    const d = describeMarginalSeparation(
      "FactorB",
      { status: "not_run_omnibus_not_significant", method: "Tukey HSD", alpha: 0.05, message: "" },
      undefined,
      false
    )!;
    expect(d.tone).toBe("withheld");
    expect(d.authoritative).toBe(false);
    expect(d.detail).toMatch(/deliberately not run/i);
    expect(d.detail).toMatch(/not a missing result/i);
  });

  it("labels means as marginal arithmetic means, never adjusted/EMM/LSMeans", () => {
    const d = describeMarginalSeparation("FactorA", okStatus, sep, false)!;
    expect(d.scaleLabel).toBe("Marginal arithmetic mean");
    const text = `${d.detail} ${d.meansProvenance} ${d.scaleLabel}`;
    expect(text).not.toMatch(/adjusted mean|EMM|LSMean|least.squares mean/i);
  });

  it("never mentions LSD as a fallback", () => {
    const d = describeMarginalSeparation("FactorA", okStatus, sep, false)!;
    expect(`${d.heading} ${d.detail}`).not.toMatch(/\bLSD\b/);
  });

  it("says a failed post-hoc did not fail the factorial ANOVA", () => {
    const d = describeMarginalSeparation(
      "FactorA", { status: "failed", method: "Tukey HSD", alpha: 0.05, message: "boom" }, undefined, false
    )!;
    expect(d.detail).toMatch(/factorial ANOVA itself completed/i);
  });
});

describe("supplementary all-cell separation", () => {
  const cellSep = {
    genotype: ["A2", "A1"], factor: ["B2", "B1"], mean: [109.7, 100.2],
    se: [0.09, 0.09], group: ["a", "b"], test: "Tukey HSD", alpha: 0.05,
    genotype_label: "FactorA", factor_label: "FactorB",
  };

  it("is labelled supplementary when the interaction governs", () => {
    const c = describeCellSeparation(result({ interaction_separation: cellSep }), true)!;
    expect(c.supplementary).toBe(true);
    expect(c.note).toMatch(/supplementary and descriptive/i);
    expect(c.note).toMatch(/simple-effects families above are the authoritative comparison/i);
  });

  it("is a plain cell-means table when the interaction does not govern", () => {
    const c = describeCellSeparation(result({ interaction_separation: cellSep }), false)!;
    expect(c.supplementary).toBe(false);
  });

  it("labels the means as cell arithmetic means", () => {
    const c = describeCellSeparation(result({ interaction_separation: cellSep }), true)!;
    expect(c.scaleLabel).toBe("Cell arithmetic mean");
    expect(c.scaleLabel).not.toMatch(/adjusted|EMM|LSMean/i);
  });

  it("returns nothing for an empty {}", () => {
    expect(describeCellSeparation(result({ interaction_separation: {} }), true)).toBeNull();
  });
});

describe("interaction plot", () => {
  const plot = {
    x_axis_factor: "FactorA",
    line_factor: "FactorB",
    y_axis_label: "Yield (cell arithmetic mean)",
    x_axis_levels: ["A1", "A2"],
    series: [
      { factor_b_level: "B1", factor_a_levels: ["A1", "A2"], mean: [100.2, 102.7], n: [3, 3] },
      { factor_b_level: "B2", factor_a_levels: ["A1", "A2"], mean: [103.1, 109.7], n: [3, 3] },
    ],
    scale_label: "Cell arithmetic mean",
    role: "descriptive_visualisation_not_a_significance_test",
    note: "Non-parallel lines suggest the effect of one factor depends on the level of the other. Read this alongside the interaction F-test; the plot alone establishes nothing.",
  };

  it("reads the governed plot contract", () => {
    const p = readInteractionPlot(result({ interaction_plot: plot }))!;
    expect(p.xAxisFactor).toBe("FactorA");
    expect(p.lineFactor).toBe("FactorB");
    expect(p.series).toHaveLength(2);
    expect(p.series[0].means).toEqual([100.2, 102.7]);
  });

  it("carries the descriptive caveat — significance comes from the F-test", () => {
    const p = readInteractionPlot(result({ interaction_plot: plot }))!;
    expect(p.note).toMatch(/plot alone establishes nothing/i);
    expect(p.note).toMatch(/interaction F-test/i);
  });

  it("labels the scale as cell arithmetic means", () => {
    expect(readInteractionPlot(result({ interaction_plot: plot }))!.scaleLabel).toBe("Cell arithmetic mean");
  });

  it("returns nothing for an empty {} or empty series", () => {
    expect(readInteractionPlot(result({ interaction_plot: {} }))).toBeNull();
    expect(readInteractionPlot(result({ interaction_plot: { series: [] } }))).toBeNull();
  });
});

describe("three-factor isolation", () => {
  it("detects a three-factor payload", () => {
    expect(hasThreeFactorOutput(result({ n_treatment_factors: 3 }))).toBe(true);
    expect(
      hasThreeFactorOutput(result({ two_way_interaction_means: { "a:b": {} } }))
    ).toBe(true);
  });

  it("reports false for an ordinary two-factor result", () => {
    expect(hasThreeFactorOutput(result({ n_treatment_factors: 2 }))).toBe(false);
    expect(hasThreeFactorOutput(result())).toBe(false);
  });

  it("does not crash, and the two-factor panel still reads only A and B", () => {
    const r = result({ n_treatment_factors: 3, mean_separation_c: { genotype: ["C1"], mean: [1], se: [null], group: ["a"], test: "Tukey HSD", alpha: 0.05 } });
    const info = readFactorialProfile(r, "factorial_crd")!;
    expect(info.factorA).toBe("FactorA");
    expect(info.factorB).toBe("FactorB");
    const text = buildFactorialSummary(info, 0.05).map((x) => x.label).join(" ");
    expect(text).not.toMatch(/Factor C/i);
  });
});

describe("legacy compatibility", () => {
  it("returns null rather than crashing when the profile is absent", () => {
    const r = result({ factorial_profile: null });
    expect(readFactorialProfile(r, "factorial_crd")).toBeNull();
    expect(isGovernedFactorial(r, "factorial_crd")).toBe(false);
  });

  it("does not crash on a result with no factorial fields at all", () => {
    const bare = { environment_mode: "single", grand_mean: 1 } as unknown as GeneticsResult;
    expect(() => readFactorialProfile(bare, "factorial_crd")).not.toThrow();
    expect(() => readSimpleEffects(bare)).not.toThrow();
    expect(() => describeCellSeparation(bare, true)).not.toThrow();
    expect(() => readInteractionPlot(bare)).not.toThrow();
    expect(hasThreeFactorOutput(bare)).toBe(false);
  });
});
