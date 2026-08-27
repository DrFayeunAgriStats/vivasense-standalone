/**
 * Phase C — governed CRD / RCBD presentation.
 *
 * The point of these tests is that the UI must never form its own opinion. Every
 * verdict comes from the backend decision object, and the tests are written so
 * that a UI which quietly recomputed significance — or fell back to 0.05 —
 * would fail rather than pass by coincidence.
 */

import { describe, it, expect } from "vitest";
import type {
  GeneticsResult,
  MeanSeparationStatus,
  TreatmentDecision,
  UploadAnalysisResponse,
} from "@/services/geneticsUploadApi";
import {
  DIAGNOSTIC_ALPHA,
  isGovernedOneFactor,
  describeOmnibus,
  describeSeparationGate,
  describeObservationAccounting,
  describeDiagnosticsPolicy,
  buildDesignSummary,
  chooseExportRoute,
  describeExportFailure,
  isStaleTokenFailure,
  STALE_TOKEN_MESSAGE,
  formatP,
} from "../governedOneFactor";
import { buildGovernedExportPayload } from "@/services/geneticsUploadApi";

const decision = (over: Partial<TreatmentDecision> = {}): TreatmentDecision => ({
  estimable: true,
  significant: true,
  p_value: 0.0123,
  alpha: 0.05,
  ...over,
});

const result = (over: Partial<GeneticsResult> = {}): GeneticsResult =>
  ({
    environment_mode: "single",
    n_genotypes: 4,
    n_reps: 4,
    n_environments: null,
    grand_mean: 100,
    variance_components: {},
    heritability: { h2_broad_sense: 0, interpretation_basis: "x" },
    genetic_parameters: { selection_intensity: 2.04 },
    ...over,
  }) as GeneticsResult;

describe("governed detection", () => {
  it("treats a CRD/RCBD result with treatment_decision as governed", () => {
    expect(isGovernedOneFactor(result({ treatment_decision: decision() }), "crd")).toBe(true);
    expect(isGovernedOneFactor(result({ treatment_decision: decision() }), "rcbd")).toBe(true);
  });

  it("does NOT treat a legacy result without the decision object as governed", () => {
    expect(isGovernedOneFactor(result(), "crd")).toBe(false);
  });

  it("does not treat an empty {} decision as governed", () => {
    // jsonlite serialises an R NULL as {}, so a truthiness check alone would
    // report governance for a field the engine never populated.
    expect(isGovernedOneFactor(result({ treatment_decision: {} as TreatmentDecision }), "crd")).toBe(
      false
    );
  });

  it("does not claim governance for factorial or split-plot in Phase C", () => {
    const r = result({ treatment_decision: decision() });
    expect(isGovernedOneFactor(r, "factorial_crd")).toBe(false);
    expect(isGovernedOneFactor(r, "factorial_rcbd")).toBe(false);
    expect(isGovernedOneFactor(r, "split_plot_rcbd")).toBe(false);
  });
});

describe("omnibus decision — CRD", () => {
  it("reports significance at α = 0.01", () => {
    const d = describeOmnibus(decision({ alpha: 0.01, p_value: 0.004, significant: true }));
    expect(d?.significant).toBe(true);
    expect(d?.sentence).toContain("was significant at α = 0.01");
    expect(d?.sentence).toContain("p = 0.0040");
  });

  it("reports significance at α = 0.05", () => {
    const d = describeOmnibus(decision({ alpha: 0.05, p_value: 0.039, significant: true }));
    expect(d?.sentence).toContain("was significant at α = 0.05");
  });

  it("switches with the selected α on the SAME p-value", () => {
    const p = 0.077;
    const at05 = describeOmnibus(decision({ alpha: 0.05, p_value: p, significant: false }));
    const at10 = describeOmnibus(decision({ alpha: 0.1, p_value: p, significant: true }));
    expect(at05?.sentence).toContain("was not significant at α = 0.05");
    expect(at10?.sentence).toContain("was significant at α = 0.10");
    // Same evidence, different threshold — the p-value text is identical.
    expect(at05?.pText).toBe(at10?.pText);
  });

  it("never substitutes 0.05 when the backend says otherwise", () => {
    // A UI that recomputed against a hardcoded 0.05 would call this significant.
    const d = describeOmnibus(decision({ alpha: 0.01, p_value: 0.039, significant: false }));
    expect(d?.significant).toBe(false);
    expect(d?.sentence).toContain("not significant at α = 0.01");
    expect(d?.sentence).not.toContain("0.05");
  });

  it("states the decision rule", () => {
    expect(describeOmnibus(decision({ alpha: 0.1 }))?.rule).toContain("p ≤ α");
    expect(describeOmnibus(decision({ alpha: 0.1 }))?.rule).toContain("0.10");
  });

  it("handles a non-estimable effect conservatively", () => {
    const d = describeOmnibus(decision({ estimable: false, significant: false }));
    expect(d?.estimable).toBe(false);
    expect(d?.sentence).toMatch(/could not be estimated/);
  });

  it("uses conservative wording — no claims of 'no effect' or 'different'", () => {
    const sig = describeOmnibus(decision({ significant: true }))!.sentence;
    const ns = describeOmnibus(decision({ significant: false }))!.sentence;
    for (const s of [sig, ns]) {
      expect(s).not.toMatch(/there is no effect|treatments are different|model is valid/i);
    }
  });

  it("formats small p-values as < 0.001", () => {
    expect(formatP(0.0000001)).toBe("p < 0.001");
    expect(formatP(null)).toBe("—");
  });
});

describe("mean-separation gate", () => {
  const status = (over: Partial<MeanSeparationStatus>): MeanSeparationStatus => ({
    status: "success",
    method: "Tukey HSD",
    alpha: 0.05,
    message: "",
    ...over,
  });

  it("shows letters when the omnibus met α", () => {
    const d = describeSeparationGate(status({ status: "success" }), true);
    expect(d?.tone).toBe("success");
    expect(d?.showLetters).toBe(true);
    expect(d?.heading).toMatch(/performed/i);
  });

  it("withholds letters when the omnibus did not meet α, and says why", () => {
    const d = describeSeparationGate(
      status({ status: "not_run_omnibus_not_significant", alpha: 0.01 }),
      false
    );
    expect(d?.tone).toBe("withheld");
    expect(d?.showLetters).toBe(false);
    expect(d?.detail).toMatch(/deliberately not run/i);
    // Must not read as missing output.
    expect(d?.detail).toMatch(/does not mean results are missing/i);
    expect(d?.detail).toContain("α = 0.01");
  });

  it("explains not_estimable conservatively", () => {
    const d = describeSeparationGate(status({ status: "not_estimable" }), false);
    expect(d?.tone).toBe("not_estimable");
    expect(d?.showLetters).toBe(false);
  });

  it("says a failed post-hoc did not fail the ANOVA", () => {
    const d = describeSeparationGate(status({ status: "failed" }), false);
    expect(d?.tone).toBe("failed");
    expect(d?.detail).toMatch(/ANOVA itself completed/i);
  });

  it("still renders legacy letters with no status object", () => {
    const d = describeSeparationGate(undefined, true);
    expect(d?.tone).toBe("unknown");
    expect(d?.showLetters).toBe(true);
  });

  it("renders nothing when there is neither status nor letters", () => {
    expect(describeSeparationGate(undefined, false)).toBeNull();
  });
});

describe("observation accounting", () => {
  it("renders counts the backend provided", () => {
    const rows = describeObservationAccounting({
      uploaded_rows: 48,
      analysed_rows: 46,
      excluded_rows: 2,
      missing_response_rows: 2,
      experimental_units: 46,
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Rows uploaded");
    expect(labels).toContain("Rows analysed");
    expect(labels).toContain("Rows excluded");
    expect(labels).toContain("Rows with no response value");
    expect(labels).toContain("Experimental units");
  });

  it("uses domain-neutral terminology — never 'genotypes'", () => {
    const rows = describeObservationAccounting({ uploaded_rows: 10, analysed_rows: 10 });
    expect(rows.map((r) => r.label).join(" ")).not.toMatch(/genotype/i);
  });

  it("returns nothing when the backend sent no accounting", () => {
    expect(describeObservationAccounting(null)).toEqual([]);
    expect(describeObservationAccounting({})).toEqual([]);
  });
});

describe("diagnostics governance", () => {
  it("keeps diagnostic α fixed at 0.05 when the user selected 0.10", () => {
    const policy = describeDiagnosticsPolicy(result(), 0.1);
    expect(policy.diagnosticAlpha).toBe(0.05);
    expect(policy.inferentialAlpha).toBe(0.1);
    expect(DIAGNOSTIC_ALPHA).toBe(0.05);
  });

  it("keeps diagnostic α fixed at 0.05 when the user selected 0.01", () => {
    expect(describeDiagnosticsPolicy(result(), 0.01).diagnosticAlpha).toBe(0.05);
  });

  it("never inherits the inferential α, for any selection", () => {
    for (const a of [0.01, 0.05, 0.1]) {
      expect(describeDiagnosticsPolicy(result(), a).diagnosticAlpha).toBe(0.05);
    }
  });

  it("uses evidence language and no certification wording", () => {
    const text = describeDiagnosticsPolicy(result(), 0.05).statements.join(" ");
    expect(text).not.toMatch(
      /assumptions? (satisfied|passed|met)|model validated|data are normal|homogeneity confirmed/i
    );
    expect(text).toMatch(/evidence/i);
  });

  it("names Q-Q as primary graphical evidence and Shapiro as supplementary", () => {
    const text = describeDiagnosticsPolicy(result(), 0.05).statements.join(" ");
    expect(text).toMatch(/Q-Q plot is the primary graphical evidence/i);
    expect(text).toMatch(/Shapiro-Wilk test is supplementary/i);
  });

  it("states nothing is deleted or transformed automatically", () => {
    const text = describeDiagnosticsPolicy(result(), 0.05).statements.join(" ");
    expect(text).toMatch(/No observation is deleted and no transformation is applied automatically/i);
  });

  it("treats independence as a design property", () => {
    const text = describeDiagnosticsPolicy(result(), 0.05).statements.join(" ");
    expect(text).toMatch(/randomised|randomized/i);
    expect(text).toMatch(/cannot be established from residuals alone/i);
  });

  it("falls back to legacy framing when no governed policy was sent", () => {
    expect(describeDiagnosticsPolicy(result(), 0.05).governed).toBe(false);
    expect(describeDiagnosticsPolicy(result({ diagnostic_policy: {} }), 0.05).governed).toBe(false);
    expect(
      describeDiagnosticsPolicy(result({ diagnostic_policy: { fixed_alpha: 0.05 } }), 0.05).governed
    ).toBe(true);
  });
});

describe("design summary", () => {
  it("names CRD and marks replicates as independent units", () => {
    const rows = buildDesignSummary("crd", result(), { treatment: "Fertiliser" }, 0.05);
    const text = rows.map((r) => `${r.label} ${r.value} ${r.note ?? ""}`).join(" ");
    expect(text).toContain("Completely Randomized Design (CRD)");
    expect(text).toContain("Fertiliser");
    expect(text).toMatch(/no blocking term/i);
  });

  it("names RCBD and marks the block as design structure, not a treatment", () => {
    const rows = buildDesignSummary("rcbd", result(), { treatment: "Variety", rep: "Block" }, 0.05);
    const blockRow = rows.find((r) => r.label === "Replication / block factor");
    expect(blockRow?.value).toBe("Block");
    expect(blockRow?.note).toMatch(/not a treatment being compared/i);
    expect(rows.find((r) => r.label === "Blocks")?.value).toBe("4");
  });

  it("shows the selected inferential α", () => {
    const rows = buildDesignSummary("rcbd", result(), { treatment: "T", rep: "B" }, 0.1);
    expect(rows.find((r) => r.label === "Inferential α")?.value).toBe("0.10");
  });

  it("shows analysed observations when accounting is present", () => {
    const rows = buildDesignSummary(
      "crd",
      result({ observation_accounting: { analysed_rows: 46 } }),
      { treatment: "T" },
      0.05
    );
    expect(rows.find((r) => r.label === "Observations analysed")?.value).toBe("46");
  });
});

describe("governed export", () => {
  const governedResponse = {
    summary_table: [],
    trait_results: {
      Yield: {
        status: "success",
        analysis_result: {
          status: "ok",
          mode: "single",
          data_validation: {},
          variance_warnings: {},
          interpretation: "",
          result: result({
            treatment_decision: decision({ alpha: 0.01 }),
            observation_accounting: { analysed_rows: 46 },
            diagnostic_policy: { fixed_alpha: 0.05 },
            mean_separation_status: { status: "success", method: "Tukey HSD", alpha: 0.01, message: "" },
          }),
        },
        error: null,
        data_warnings: [],
      },
    },
    dataset_summary: { n_genotypes: 4, n_reps: 4, n_traits: 1, mode: "single" },
    failed_traits: [],
    export_token: "exact-token-xyz",
    analysis_settings: { inferential_alpha: 0.01, diagnostic_alpha: 0.05 },
  } as unknown as UploadAnalysisResponse;

  it("routes to the governed path when a token exists", () => {
    expect(chooseExportRoute(governedResponse)).toBe("governed");
  });

  it("routes to legacy when no token exists — never fabricating one", () => {
    expect(chooseExportRoute({ ...governedResponse, export_token: null })).toBe("legacy");
    expect(chooseExportRoute({ ...governedResponse, export_token: "" })).toBe("legacy");
    expect(chooseExportRoute(null)).toBe("legacy");
  });

  it("preserves the exact token, α, decisions, accounting and policy", () => {
    const payload = buildGovernedExportPayload(governedResponse, { module: "anova" }) as {
      export_token?: string;
      analysis_settings?: { inferential_alpha?: number; diagnostic_alpha?: number };
      trait_results: Record<string, { analysis_result?: { result?: GeneticsResult } }>;
    };
    expect(payload.export_token).toBe("exact-token-xyz");
    expect(payload.analysis_settings?.inferential_alpha).toBe(0.01);
    expect(payload.analysis_settings?.diagnostic_alpha).toBe(0.05);
    const r = payload.trait_results.Yield.analysis_result?.result;
    expect(r?.treatment_decision?.alpha).toBe(0.01);
    expect(r?.observation_accounting).toBeDefined();
    expect(r?.diagnostic_policy).toBeDefined();
    expect(r?.mean_separation_status?.status).toBe("success");
  });
});

describe("exact-token failure handling", () => {
  it("recognises a 409 status", () => {
    expect(isStaleTokenFailure(409, "anything")).toBe(true);
  });

  it("recognises the backend's own wording when no status is available", () => {
    // The shared client throws the `detail` prose, not the code.
    const detail =
      "The original analysis result is no longer available for secure export. Please rerun the analysis and generate the report again.";
    expect(isStaleTokenFailure(null, detail)).toBe(true);
    expect(describeExportFailure(null, detail)).toBe(STALE_TOKEN_MESSAGE);
  });

  it("tells the user to rerun and promises no substitute report", () => {
    expect(STALE_TOKEN_MESSAGE).toMatch(/rerun the analysis/i);
    expect(STALE_TOKEN_MESSAGE).toMatch(/no substitute report/i);
  });

  it("does not mistake an ordinary failure for a stale token", () => {
    expect(isStaleTokenFailure(null, "Network error during Word export")).toBe(false);
    expect(describeExportFailure(null, "Network error during Word export")).toBe(
      "Network error during Word export"
    );
  });

  it("handles a Pro-mode refusal separately", () => {
    expect(describeExportFailure(403, "forbidden")).toMatch(/product mode/i);
  });
});

describe("contradiction guards", () => {
  it("UI never says significant when the backend says nonsignificant at α = 0.01", () => {
    const d = describeOmnibus(decision({ alpha: 0.01, p_value: 0.039, significant: false }))!;
    expect(d.significant).toBe(false);
    expect(d.sentence).toMatch(/not significant/);
    expect(d.sentence).not.toMatch(/\bwas significant\b/);
  });

  it("UI never labels separation successful when the status says withheld", () => {
    const gate = describeSeparationGate(
      { status: "not_run_omnibus_not_significant", method: "Tukey HSD", alpha: 0.05, message: "" },
      // Letters present in the payload must NOT override a withheld status.
      true
    )!;
    expect(gate.tone).toBe("withheld");
    expect(gate.showLetters).toBe(false);
    expect(gate.heading).not.toMatch(/performed/i);
  });

  it("diagnostics never display the selected inferential α as the diagnostic α", () => {
    const policy = describeDiagnosticsPolicy(result(), 0.1);
    expect(policy.diagnosticAlpha).not.toBe(policy.inferentialAlpha);
    expect(policy.statements.join(" ")).toMatch(/fixed reference α = 0.05/);
  });

  it("a stale-token failure never falls back to another report", () => {
    const message = describeExportFailure(409, "conflict");
    expect(message).toMatch(/no substitute report will be produced/i);
    expect(message).not.toMatch(/retry|fallback|cached copy/i);
  });
});

describe("legacy compatibility", () => {
  const legacy = result({ mean_separation: { genotype: ["A"], mean: [1], se: [null], group: ["a"], test: "Tukey HSD", alpha: 0.05 } });

  it("renders a legacy CRD without governance objects", () => {
    expect(isGovernedOneFactor(legacy, "crd")).toBe(false);
    expect(describeOmnibus(legacy.treatment_decision)).toBeNull();
    expect(describeObservationAccounting(legacy.observation_accounting)).toEqual([]);
  });

  it("still shows legacy grouping letters", () => {
    const gate = describeSeparationGate(legacy.mean_separation_status, true)!;
    expect(gate.showLetters).toBe(true);
  });

  it("does not crash on an entirely empty result", () => {
    expect(() => describeOmnibus(null)).not.toThrow();
    expect(() => describeSeparationGate(null, false)).not.toThrow();
    expect(() => buildDesignSummary("crd", result(), {}, 0.05)).not.toThrow();
  });
});
