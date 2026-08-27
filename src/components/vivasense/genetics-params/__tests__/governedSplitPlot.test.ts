/**
 * Phase E — governed split-plot interpretation.
 *
 * Two things carry most of the scientific weight here. First, WHICH error
 * stratum each term is tested against: the whole-plot factor must show Error A,
 * never Error B, because testing it on the subplot error inflates F enormously
 * (15 vs 2550 on the reference fixture). Second, SPF-1: design identity must
 * come from the profile, so a correctly withheld protected LSD cannot make the
 * report forget it is looking at a split-plot.
 */

import { describe, it, expect } from "vitest";
import type { GeneticsResult, GovernedDecision, MeanSeparationStatus } from "@/services/geneticsUploadApi";
import {
  isGovernedSplitPlot,
  readSplitPlotProfile,
  buildSplitPlotSummary,
  describeExperimentalUnits,
  readErrorStrata,
  readSplitPlotDecisions,
  describeSplitPlotHierarchy,
  describeProtectedLsd,
  readInteractionMeans,
  readSplitPlotInteractionPlot,
  splitPlotDiagnosticStatements,
  NO_SIMPLE_EFFECTS_NOTICE,
  PLOT_SIGNIFICANCE_NOTE,
} from "../governedSplitPlot";
import { describeObservationAccounting } from "../governedOneFactor";
import { describeResultScale, buildDescriptiveStats } from "../resultCounts";

/** The real shape the deployed engine returns — verified against production. */
const PROFILE = {
  design: "split_plot_rcbd",
  block_factor: "rep",
  block_count: 4,
  whole_plot_factor: "Main",
  whole_plot_levels: ["M1", "M2", "M3"],
  sub_plot_factor: "Sub",
  sub_plot_levels: ["S1", "S2", "S3"],
  whole_plots: 12,
  sub_plots: 36,
  expected_observations: 36,
  analysed_observations: 36,
  balanced_complete: true,
  model_formula: "response ~ A * B + Error(block/A)",
  denominators: {
    whole_plot_factor: "Error A (whole-plot, Block x A)",
    sub_plot_factor: "Error B (subplot)",
    interaction: "Error B (subplot)",
  },
  replication_note:
    "The whole-plot factor is replicated once per block... Subplot observations are NOT independent replicates of the whole-plot factor.",
};

/**
 * Discriminator fixture: Error A MS is ~76x Error B MS. If the UI ever paired a
 * term with the wrong stratum, these numbers would make it obvious.
 */
const ERROR_A = { stratum: "Error A (whole-plot, Block x A)", df: 6, ms: 4.3258962963 };
const ERROR_B = { stratum: "Error B (subplot)", df: 18, ms: 0.057057407407 };

const dec = (
  significant: boolean,
  p: number,
  alpha: number,
  e: { stratum: string; df: number; ms: number }
): GovernedDecision => ({
  estimable: true,
  significant,
  p_value: p,
  alpha,
  rule: "p_value <= alpha",
  error_stratum: e.stratum,
  denominator_df: e.df,
  denominator_ms: e.ms,
});

const result = (over: Partial<GeneticsResult> = {}): GeneticsResult =>
  ({
    environment_mode: "single",
    n_genotypes: null,
    n_reps: 4,
    n_environments: null,
    grand_mean: 110,
    variance_components: {},
    heritability: { h2_broad_sense: 0, interpretation_basis: "x" },
    genetic_parameters: { selection_intensity: 2.04 },
    design: "split_plot_rcbd",
    split_plot_profile: PROFILE,
    whole_plot_decision: dec(true, 0.000244, 0.05, ERROR_A),
    sub_plot_decision: dec(true, 6.2e-24, 0.05, ERROR_B),
    split_plot_interaction_decision: dec(false, 0.9954, 0.05, ERROR_B),
    ...over,
  }) as unknown as GeneticsResult;

const info = () => readSplitPlotProfile(result(), { rep: "Block" })!;

describe("governed split-plot detection", () => {
  it("recognises a governed split-plot", () => {
    expect(isGovernedSplitPlot(result(), "split_plot_rcbd")).toBe(true);
  });

  it("rejects an empty {} profile from jsonlite", () => {
    expect(isGovernedSplitPlot(result({ split_plot_profile: {} }), "split_plot_rcbd")).toBe(false);
  });

  it("rejects empty {} decisions", () => {
    expect(
      isGovernedSplitPlot(result({ whole_plot_decision: {} as GovernedDecision }), "split_plot_rcbd")
    ).toBe(false);
  });

  it("does NOT infer identity from main_plot_mean_separation — the SPF-1 guard", () => {
    const noProfile = result({
      split_plot_profile: null,
      main_plot_mean_separation: {
        genotype: ["M1"], mean: [1], se: [null], group: ["a"], test: "Protected Fisher's LSD", alpha: 0.05,
      },
    });
    expect(isGovernedSplitPlot(noProfile, "split_plot_rcbd")).toBe(false);
  });

  it("does not infer identity from interaction means or the design label alone", () => {
    const r = result({ split_plot_profile: null, interaction_means: { cell_means: {} }, design: "split_plot_rcbd" });
    expect(isGovernedSplitPlot(r, "split_plot_rcbd")).toBe(false);
  });

  it("does not claim split-plot governance for other designs", () => {
    for (const d of ["crd", "rcbd", "factorial_crd", "factorial_rcbd"] as const) {
      expect(isGovernedSplitPlot(result(), d)).toBe(false);
    }
  });
});

describe("design structure", () => {
  it("reads structure from the profile", () => {
    const i = info();
    expect(i.wholePlotFactor).toBe("Main");
    expect(i.subPlotFactor).toBe("Sub");
    expect(i.wholePlotLevels).toEqual(["M1", "M2", "M3"]);
    expect(i.blockCount).toBe(4);
    expect(i.wholePlots).toBe(12);
    expect(i.subPlots).toBe(36);
    expect(i.analysedObservations).toBe(36);
  });

  it("prefers the mapped column name over the engine's generic 'rep' token", () => {
    expect(info().blockFactor).toBe("Block");
  });

  it("keeps a real profile block name when the engine sends one", () => {
    const i = readSplitPlotProfile(
      result({ split_plot_profile: { ...PROFILE, block_factor: "FieldBlock" } }), { rep: "Block" }
    )!;
    expect(i.blockFactor).toBe("FieldBlock");
  });

  it("renders design rows including model and α, with no null counts", () => {
    const rows = buildSplitPlotSummary(info(), 0.01);
    const text = rows.map((r) => `${r.label} ${r.value}`).join(" ");
    expect(text).toContain("Split-Plot RCBD");
    expect(text).toContain("Error(block/A)");
    expect(rows.find((r) => r.label === "Inferential α")?.value).toBe("0.01");
    expect(text).not.toMatch(/null|undefined|NaN/);
  });

  it("marks the block as design structure, not a treatment", () => {
    const row = buildSplitPlotSummary(info(), 0.05).find((r) => r.label === "Replication / block factor");
    expect(row?.note).toMatch(/not a treatment being compared/i);
  });
});

describe("experimental-unit accounting", () => {
  const units = describeExperimentalUnits(info());

  it("states the whole plot is the unit for factor A", () => {
    expect(units.statements[0]).toMatch(/Main is applied to whole plots/i);
    expect(units.statements[0]).toMatch(/whole plot is its experimental unit/i);
  });

  it("states subplots are NOT independent replicates of factor A", () => {
    expect(units.statements[0]).toMatch(/not independent replicates of Main/i);
  });

  it("states the subplot is the unit for factor B and the interaction", () => {
    expect(units.statements[1]).toMatch(/Sub and the Main × Sub interaction/);
    expect(units.statements[1]).toMatch(/subplot is their experimental unit/i);
  });

  it("carries the engine's own replication note when present", () => {
    expect(units.engineNote).toMatch(/NOT independent replicates/i);
  });

  it("invents no counts", () => {
    const text = units.statements.join(" ");
    expect(text).not.toMatch(/\b\d+\s+(observations|units|plots)\b/);
  });
});

// ── The central protection ───────────────────────────────────────────────────

describe("denominator integrity", () => {
  const strata = readErrorStrata(result(), info());
  const decisions = readSplitPlotDecisions(result(), info());

  it("Factor A is tested against Error A", () => {
    const a = decisions.find((d) => d.key === "a")!;
    expect(a.errorStratum).toBe(ERROR_A.stratum);
    expect(a.denominatorDf).toBe(6);
    expect(a.denominatorMs).toBeCloseTo(4.3258962963, 9);
  });

  it("Factor B is tested against Error B", () => {
    const b = decisions.find((d) => d.key === "b")!;
    expect(b.errorStratum).toBe(ERROR_B.stratum);
    expect(b.denominatorDf).toBe(18);
    expect(b.denominatorMs).toBeCloseTo(0.057057407407, 9);
  });

  it("A × B is tested against Error B", () => {
    const ab = decisions.find((d) => d.key === "ab")!;
    expect(ab.errorStratum).toBe(ERROR_B.stratum);
    expect(ab.denominatorDf).toBe(18);
  });

  it("NEVER pairs Factor A with Error B", () => {
    const a = decisions.find((d) => d.key === "a")!;
    expect(a.errorStratum).not.toBe(ERROR_B.stratum);
    expect(a.denominatorMs).not.toBeCloseTo(ERROR_B.ms, 6);
    expect(a.denominatorDf).not.toBe(ERROR_B.df);
  });

  it("the strata differ enough that a mix-up would be unmistakable", () => {
    expect(ERROR_A.ms / ERROR_B.ms).toBeGreaterThan(50);
  });

  it("lists Error A as the denominator for the whole-plot factor only", () => {
    const errorA = strata.find((s) => s.name === ERROR_A.stratum)!;
    expect(errorA.testedTerms).toEqual(["Main"]);
    expect(errorA.df).toBe(6);
    expect(errorA.ms).toBeCloseTo(4.3258962963, 9);
  });

  it("lists Error B as the denominator for the subplot factor and the interaction", () => {
    const errorB = strata.find((s) => s.name === ERROR_B.stratum)!;
    expect(errorB.testedTerms).toContain("Sub");
    expect(errorB.testedTerms).toContain("Main × Sub");
    expect(errorB.df).toBe(18);
  });

  it("reads strata from the decisions, so a changed engine mapping would show through", () => {
    const swapped = result({ whole_plot_decision: dec(true, 0.01, 0.05, ERROR_B) });
    const d = readSplitPlotDecisions(swapped, info()).find((x) => x.key === "a")!;
    // Not an endorsement — proof the display follows the payload rather than a
    // hardcoded textbook mapping.
    expect(d.errorStratum).toBe(ERROR_B.stratum);
  });
});

// ── Alpha matrix ─────────────────────────────────────────────────────────────

describe("selected-alpha decisions", () => {
  const cases: [string, number, number, boolean][] = [
    ["p≈.04 at α=.01 → not significant", 0.04031, 0.01, false],
    ["p≈.04 at α=.05 → significant", 0.04031, 0.05, true],
    ["p≈.07 at α=.05 → not significant", 0.06989, 0.05, false],
    ["p≈.07 at α=.10 → significant", 0.06989, 0.1, true],
  ];
  for (const [label, p, alpha, significant] of cases) {
    it(label, () => {
      const r = result({ whole_plot_decision: dec(significant, p, alpha, ERROR_A) });
      const d = readSplitPlotDecisions(r, info()).find((x) => x.key === "a")!;
      expect(d.significant).toBe(significant);
      expect(d.alpha).toBe(alpha);
    });
  }

  it("never falls back to a hardcoded 0.05", () => {
    const r = result({ whole_plot_decision: dec(false, 0.039, 0.01, ERROR_A) });
    const h = describeSplitPlotHierarchy(readSplitPlotDecisions(r, info()), info())!;
    expect(h.marginalGuidance).toContain("α = 0.05"); // interaction alpha is 0.05 here
    const d = readSplitPlotDecisions(r, info()).find((x) => x.key === "a")!;
    expect(d.significant).toBe(false);
    expect(d.alpha).toBe(0.01);
  });
});

// ── Hierarchy and the v1 limitation ──────────────────────────────────────────

describe("interaction hierarchy", () => {
  const sig = result({ split_plot_interaction_decision: dec(true, 0.0001, 0.05, ERROR_B) });

  it("leads with the interaction when significant, and names its stratum", () => {
    const h = describeSplitPlotHierarchy(readSplitPlotDecisions(sig, info()), info())!;
    expect(h.interactionSignificant).toBe(true);
    expect(h.headline).toMatch(/primary inferential result/i);
    expect(h.headline).toMatch(/depends on the level of/i);
    expect(h.headline).toContain("Error B (subplot)");
  });

  it("makes marginal effects secondary and forbids unconditional claims", () => {
    const h = describeSplitPlotHierarchy(readSplitPlotDecisions(sig, info()), info())!;
    expect(h.marginalGuidance).toMatch(/secondary summaries/i);
    expect(h.marginalGuidance).toMatch(/must not be read as unconditional effects/i);
    const all = `${h.headline} ${h.marginalGuidance}`;
    expect(all).not.toMatch(/\bsignificantly affected\b/i);
  });

  it("states the no-simple-effects limitation whenever the interaction is significant", () => {
    const h = describeSplitPlotHierarchy(readSplitPlotDecisions(sig, info()), info())!;
    expect(h.limitation).toBe(NO_SIMPLE_EFFECTS_NOTICE);
    expect(h.limitation).toMatch(/not provided in Split-Plot RCBD v1/i);
    expect(h.limitation).toMatch(/Satterthwaite/i);
    expect(h.limitation).toMatch(/descriptive only/i);
    expect(h.limitation).toMatch(/not simple-effects tests/i);
  });

  it("allows marginal interpretation and omits the limitation when the interaction is not significant", () => {
    const h = describeSplitPlotHierarchy(readSplitPlotDecisions(result(), info()), info())!;
    expect(h.interactionSignificant).toBe(false);
    expect(h.limitation).toBeNull();
    expect(h.headline).toMatch(/interpretable on its own/i);
    expect(h.marginalGuidance).toContain("Error A");
    expect(h.marginalGuidance).toContain("Error B");
  });
});

// ── Protected LSD gates ──────────────────────────────────────────────────────

const lsdStatus = (
  status: string,
  factor: string,
  e: { stratum: string; df: number; ms: number },
  alpha = 0.05
): MeanSeparationStatus =>
  ({
    method: "Protected Fisher's LSD",
    factor,
    alpha,
    status,
    error_stratum: e.stratum,
    error_df: e.df,
    error_ms: e.ms,
    means_provenance: `Marginal arithmetic mean of ${factor}.`,
    protection: `Fisher's LSD is protected by the ${factor} omnibus F-test.`,
    message: "msg",
  }) as unknown as MeanSeparationStatus;

const sepA = {
  genotype: ["M3", "M2", "M1"], mean: [113.6, 109.2, 105.6], se: [null, null, null],
  group: ["a", "b", "c"], test: "Protected Fisher's LSD", alpha: 0.05,
  treatment_label: "Main", scale_label: "Marginal arithmetic mean",
};

describe("protected Fisher's LSD — the four gate combinations", () => {
  const combos: [string, boolean, boolean][] = [
    ["A sig / B sig", true, true],
    ["A sig / B ns", true, false],
    ["A ns / B sig", false, true],
    ["A ns / B ns", false, false],
  ];

  for (const [label, aOpen, bOpen] of combos) {
    it(label, () => {
      const a = describeProtectedLsd(
        "Main",
        lsdStatus(aOpen ? "success" : "not_run_omnibus_not_significant", "Main", ERROR_A),
        aOpen ? sepA : undefined,
        false
      )!;
      const b = describeProtectedLsd(
        "Sub",
        lsdStatus(bOpen ? "success" : "not_run_omnibus_not_significant", "Sub", ERROR_B),
        undefined,
        false
      )!;
      expect(a.tone).toBe(aOpen ? "success" : "withheld");
      expect(b.tone).toBe(bOpen ? "success" : "withheld");
      // Each gate is independent of the other.
      expect(a.authoritative).toBe(aOpen);
      expect(b.authoritative).toBe(bOpen);
      expect(a.errorStratum).toBe(ERROR_A.stratum);
      expect(b.errorStratum).toBe(ERROR_B.stratum);
    });
  }

  it("reports Factor A on Error A and Factor B on Error B", () => {
    const a = describeProtectedLsd("Main", lsdStatus("success", "Main", ERROR_A), sepA, false)!;
    expect(a.errorDf).toBe(6);
    expect(a.errorMs).toBeCloseTo(4.3258962963, 9);
    expect(a.heading).toMatch(/Protected Fisher's LSD/);
    const b = describeProtectedLsd("Sub", lsdStatus("success", "Sub", ERROR_B), undefined, false)!;
    expect(b.errorDf).toBe(18);
  });

  it("explains a withheld gate as the protection working, not a missing result", () => {
    const a = describeProtectedLsd(
      "Main", lsdStatus("not_run_omnibus_not_significant", "Main", ERROR_A, 0.01), undefined, false
    )!;
    expect(a.detail).toMatch(/deliberately not run/i);
    expect(a.detail).toMatch(/forfeit the protection/i);
    expect(a.detail).toMatch(/not a missing result/i);
    expect(a.detail).toContain("α = 0.01");
    expect(a.showLetters).toBe(false);
  });

  it("supports not_estimable and failed", () => {
    expect(describeProtectedLsd("Main", lsdStatus("not_estimable", "Main", ERROR_A), undefined, false)!.tone)
      .toBe("not_estimable");
    const failed = describeProtectedLsd("Main", lsdStatus("failed", "Main", ERROR_A), undefined, false)!;
    expect(failed.tone).toBe("failed");
    expect(failed.detail).toMatch(/split-plot ANOVA itself completed/i);
  });

  it("demotes marginal LSD to secondary while the interaction governs", () => {
    const a = describeProtectedLsd("Main", lsdStatus("success", "Main", ERROR_A), sepA, true)!;
    expect(a.tone).toBe("success");
    expect(a.authoritative).toBe(false);
    expect(a.showLetters).toBe(false);
  });

  it("never substitutes Tukey", () => {
    const a = describeProtectedLsd("Main", lsdStatus("success", "Main", ERROR_A), sepA, false)!;
    expect(`${a.heading} ${a.detail}`).not.toMatch(/Tukey/i);
    expect(a.method).toBe("Protected Fisher's LSD");
  });
});

// ── SPF-1 ────────────────────────────────────────────────────────────────────

describe("SPF-1 regression — withheld whole-plot LSD must not erase the split-plot", () => {
  // Whole-plot p = 0.04031, analysed at α = 0.01 → nonsignificant → LSD withheld.
  const spf1 = result({
    whole_plot_decision: dec(false, 0.04031, 0.01, ERROR_A),
    sub_plot_decision: dec(true, 1e-9, 0.01, ERROR_B),
    split_plot_interaction_decision: dec(false, 0.5, 0.01, ERROR_B),
    main_plot_separation_status: lsdStatus("not_run_omnibus_not_significant", "Main", ERROR_A, 0.01),
    main_plot_mean_separation: null,
    interaction_means: {
      main_plot_levels: ["M1", "M2", "M3"],
      sub_plot_levels: ["S1", "S2"],
      cell_means: {
        main_plot: ["M1", "M2", "M3", "M1", "M2", "M3"],
        sub_plot: ["S1", "S1", "S1", "S2", "S2", "S2"],
        trait_value: [101.6, 105.2, 109.6, 105.6, 109.2, 113.6],
      },
      scale_label: "Cell arithmetic mean",
      cell_se: 0.119,
    },
  });

  it("the gate really is shut — otherwise this test proves nothing", () => {
    expect(spf1.whole_plot_decision!.significant).toBe(false);
    expect(spf1.main_plot_separation_status!.status).toBe("not_run_omnibus_not_significant");
    expect(spf1.main_plot_mean_separation).toBeNull();
  });

  it("is still recognised as a governed split-plot", () => {
    expect(isGovernedSplitPlot(spf1, "split_plot_rcbd")).toBe(true);
  });

  it("still renders the design structure", () => {
    const i = readSplitPlotProfile(spf1, { rep: "Block" })!;
    expect(buildSplitPlotSummary(i, 0.01).length).toBeGreaterThan(5);
  });

  it("still renders the error strata with both denominators", () => {
    const strata = readErrorStrata(spf1, info());
    expect(strata).toHaveLength(2);
    expect(strata[0].ms).toBeCloseTo(ERROR_A.ms, 9);
    expect(strata[1].ms).toBeCloseTo(ERROR_B.ms, 9);
  });

  it("still renders all three decisions", () => {
    expect(readSplitPlotDecisions(spf1, info())).toHaveLength(3);
  });

  it("still renders the hierarchy", () => {
    expect(describeSplitPlotHierarchy(readSplitPlotDecisions(spf1, info()), info())).not.toBeNull();
  });

  it("still renders interaction means and the plot", () => {
    expect(readInteractionMeans(spf1)).not.toBeNull();
    expect(readSplitPlotInteractionPlot(spf1, info())).not.toBeNull();
  });

  it("still renders the experimental-unit caution", () => {
    expect(describeExperimentalUnits(info()).statements.length).toBe(3);
  });

  it("still renders the withheld-LSD explanation rather than nothing", () => {
    const a = describeProtectedLsd("Main", spf1.main_plot_separation_status, null, false)!;
    expect(a.tone).toBe("withheld");
    expect(a.detail).toMatch(/deliberately not run/i);
  });
});

// ── Interaction means / plot ─────────────────────────────────────────────────

describe("interaction means and plot", () => {
  const r = result({
    interaction_means: {
      main_plot_levels: ["M1", "M2"],
      sub_plot_levels: ["S1", "S2"],
      cell_means: {
        main_plot: ["M1", "M2", "M1", "M2"],
        sub_plot: ["S1", "S1", "S2", "S2"],
        trait_value: [101.6, 105.2, 105.6, 109.2],
      },
      scale_label: "Cell arithmetic mean",
      cell_se: 0.119,
    },
  });

  it("labels the means as cell arithmetic means only", () => {
    const m = readInteractionMeans(r)!;
    expect(m.scaleLabel).toBe("Cell arithmetic mean");
    expect(m.note).not.toMatch(/adjusted mean|LSMean|EMM|simple.effect estimate/i);
    expect(m.note).toMatch(/not simple-effects estimates/i);
  });

  it("reshapes into plot series with whole plot on x and subplot as lines", () => {
    const p = readSplitPlotInteractionPlot(r, info())!;
    expect(p.xAxisFactor).toBe("Main");
    expect(p.lineFactor).toBe("Sub");
    expect(p.xLevels).toEqual(["M1", "M2"]);
    expect(p.series).toHaveLength(2);
    expect(p.series[0].means).toEqual([101.6, 105.2]);
  });

  it("carries the significance caveat", () => {
    expect(readSplitPlotInteractionPlot(r, info())!.note).toBe(PLOT_SIGNIFICANCE_NOTE);
    expect(PLOT_SIGNIFICANCE_NOTE).toMatch(/not the visual shape of the lines/i);
  });

  it("returns nothing for {} or missing cell means", () => {
    expect(readInteractionMeans(result({ interaction_means: {} }))).toBeNull();
    expect(readInteractionMeans(result({ interaction_means: { cell_means: {} } }))).toBeNull();
  });
});

// ── Accounting, typing debt, diagnostics ─────────────────────────────────────

describe("observation accounting", () => {
  it("renders a full accounting object", () => {
    expect(describeObservationAccounting({ uploaded_rows: 36, analysed_rows: 36 })).toHaveLength(2);
  });

  it("treats {} as absent — the live engine sends {} for split-plot", () => {
    expect(describeObservationAccounting({})).toEqual([]);
  });

  it("treats null/undefined as absent", () => {
    expect(describeObservationAccounting(null)).toEqual([]);
    expect(describeObservationAccounting(undefined)).toEqual([]);
  });
});

describe("n_genotypes / n_reps typing debt", () => {
  it("never renders 'null treatments' or 'undefined replications'", () => {
    const r = result({ n_genotypes: null, n_reps: null });
    const scale = describeResultScale(r);
    expect(scale).not.toMatch(/null|undefined|NaN/);
    const rows = buildDescriptiveStats(r).map((x) => `${x.label} ${x.value}`).join(" ");
    expect(rows).not.toMatch(/null|undefined|NaN/);
  });

  it("omits counts the design does not have rather than showing zero", () => {
    const rows = buildDescriptiveStats(result({ n_genotypes: null, n_reps: null }));
    expect(rows.map((x) => x.label)).toEqual(["Grand Mean"]);
  });

  it("still shows counts for designs that do have them", () => {
    const rows = buildDescriptiveStats(result({ n_genotypes: 4, n_reps: 4 }));
    expect(rows.map((x) => x.label)).toEqual(["Grand Mean", "Treatment Levels", "Replications"]);
    expect(describeResultScale(result({ n_genotypes: 4, n_reps: 4 }))).toContain("4 treatment levels");
  });
});

describe("split-plot diagnostics disclosure", () => {
  const statements = splitPlotDiagnosticStatements(info());

  it("says residual diagnostics relate primarily to the subplot stratum", () => {
    expect(statements[0]).toMatch(/subplot \(Error B\) stratum/i);
  });

  it("discloses Error A separately for whole-plot inference", () => {
    expect(statements[1]).toMatch(/Whole-plot \(Error A\)/i);
    expect(statements[1]).toMatch(/fewer degrees of freedom/i);
  });

  it("treats independence as a randomisation property", () => {
    expect(statements[2]).toMatch(/randomised/i);
    expect(statements[2]).toMatch(/cannot be established from residuals/i);
  });

  it("uses no certification wording", () => {
    expect(statements.join(" ")).not.toMatch(
      /assumptions? (satisfied|passed|met)|model validated|data are normal|homogeneity confirmed/i
    );
  });
});

describe("three-factor isolation and legacy safety", () => {
  it("the split-plot panel reads only whole-plot and subplot factors", () => {
    const text = buildSplitPlotSummary(info(), 0.05).map((r) => r.label).join(" ");
    expect(text).not.toMatch(/Factor C/i);
  });

  it("does not crash on a bare result", () => {
    const bare = { environment_mode: "single", grand_mean: 1 } as unknown as GeneticsResult;
    expect(readSplitPlotProfile(bare)).toBeNull();
    expect(() => readInteractionMeans(bare)).not.toThrow();
    expect(isGovernedSplitPlot(bare, "split_plot_rcbd")).toBe(false);
  });
});
