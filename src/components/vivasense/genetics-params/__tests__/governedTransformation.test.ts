/**
 * Phase F — governed RCBD transformation workflow.
 *
 * Exploring a transformation and adopting it are different acts. The backend
 * stamps every exploration `exploratory_not_selected_for_inference`, and the raw
 * analysis keeps inferential authority until a person deliberately says
 * otherwise. These tests pin that separation, the boundary block, and the fact
 * that nothing in the workflow mutates the raw branch.
 */

import { describe, it, expect } from "vitest";
import type { GeneticsResult, UploadAnalysisResponse } from "@/services/geneticsUploadApi";
import type {
  ExplorationResponse,
  SelectedTransformedAnalysis,
} from "@/services/rcbdTransformationApi";
import {
  SELECTION_ACTION,
  explorationEligibility,
  buildExplorationRequest,
  buildSelectionRequest,
  readLambda,
  readSelectionGate,
  readSelectedBranch,
  describeTransformationFailure,
  authorityLabel,
  authorityDetail,
  semanticsCaution,
  isContinuousSemantics,
  snapshotRaw,
  rawSnapshotsEqual,
  TRANSFORMED_DIAGNOSTICS_NOTE,
  SELECTION_MEANING_NOTE,
  NON_CONTINUOUS_TYPES,
} from "../governedTransformation";

const rawResult = (over: Partial<GeneticsResult> = {}): GeneticsResult =>
  ({
    environment_mode: "single",
    n_genotypes: 4,
    n_reps: 4,
    n_environments: null,
    grand_mean: 100,
    variance_components: {},
    heritability: { h2_broad_sense: 0, interpretation_basis: "x" },
    genetic_parameters: { selection_intensity: 2.04 },
    treatment_decision: { estimable: true, significant: true, p_value: 1.98e-11, alpha: 0.05 },
    mean_separation: {
      genotype: ["T4", "T3"], mean: [4.13, 3.94], se: [null, null],
      group: ["a", "b"], test: "Tukey HSD", alpha: 0.05,
    },
    ...over,
  }) as unknown as GeneticsResult;

/** Real ineligible exploration — boundary hit + truncated interval (verified live). */
const INELIGIBLE_CANDIDATE = {
  status: "computed",
  transform: "box_cox",
  formula: "(((x + 0)^-2) - 1) / -2",
  inverse_formula: "(-2 * z + 1)^(1 / -2) - 0",
  lambda: -2.0,
  lambda_profile: {
    search_minimum: -2.0, search_maximum: 2.0, increment: 0.05,
    profile_interval: [-2.0, 2.0], confidence_level: 0.95,
    boundary_hit: true, interval_truncated: true, exact_vs_approximation: "exact",
  },
  shift: 0.0,
  warnings: [
    "The Box-Cox optimum occurs at the search boundary; the optimum may lie outside the evaluated grid.",
    "The Box-Cox profile interval is truncated by the evaluated search grid.",
  ],
};

/** Real eligible exploration — λ = 0, interval [-0.2, 0.2] (verified live). */
const ELIGIBLE_CANDIDATE = {
  status: "computed",
  transform: "box_cox",
  formula: "log(x + 0)",
  inverse_formula: "exp(z) - 0",
  lambda: 0.0,
  lambda_profile: {
    search_minimum: -2.0, search_maximum: 2.0, increment: 0.05,
    profile_interval: [-0.2, 0.2], confidence_level: 0.95,
    boundary_hit: false, interval_truncated: false, exact_vs_approximation: "exact",
  },
  shift: 0.0,
  warnings: [],
};

const exploration = (
  candidate: Record<string, unknown>,
  eligible: boolean,
  reasons: string[] = []
): ExplorationResponse =>
  ({
    transformed_branch_token: "branch-token-1",
    raw_analysis_token: "raw-token-1",
    dataset_token: "ds-1",
    module: "anova",
    trait: "Yield",
    original_trait: "Yield",
    sanitized_trait: "Yield",
    design: "rcbd",
    inferential_alpha: 0.05,
    model_frame_identity: "sha256:" + "a".repeat(64),
    eligibility_status: eligible ? "eligible_for_future_selection" : "ineligible_for_selection",
    eligibility_reasons: reasons,
    authority: "exploratory_not_selected_for_inference",
    exploration_available: true,
    user_initiated: true,
    not_selected_for_inference: true,
    response_semantics: { response_type: "continuous" },
    raw_reference: {},
    candidate,
    transformed_evidence: {},
    provenance: {},
  }) as unknown as ExplorationResponse;

describe("eligibility", () => {
  it("offers exploration for a governed continuous RCBD", () => {
    expect(explorationEligibility("rcbd", rawResult(), "success", "tok").available).toBe(true);
  });

  it("does not offer it for non-RCBD designs", () => {
    for (const d of ["crd", "factorial_crd", "factorial_rcbd", "split_plot_rcbd"] as const) {
      const e = explorationEligibility(d, rawResult(), "success", "tok");
      expect(e.available).toBe(false);
      expect(e.reason).toMatch(/one-factor RCBD only/i);
    }
  });

  it("does not offer it for a legacy result lacking the governed decision", () => {
    const e = explorationEligibility("rcbd", rawResult({ treatment_decision: undefined }), "success", "tok");
    expect(e.available).toBe(false);
    expect(e.reason).toMatch(/predates the governed analysis contract/i);
  });

  it("does not offer it for a failed trait", () => {
    expect(explorationEligibility("rcbd", rawResult(), "failed", "tok").available).toBe(false);
    expect(explorationEligibility("rcbd", null, "success", "tok").available).toBe(false);
  });

  it("does not offer it without an exact raw-analysis identity", () => {
    const e = explorationEligibility("rcbd", rawResult(), "success", null);
    expect(e.available).toBe(false);
    expect(e.reason).toMatch(/exact raw-analysis identity is unavailable/i);
  });
});

describe("response semantics", () => {
  it("treats only 'continuous' as the plain Box-Cox case", () => {
    expect(isContinuousSemantics("continuous")).toBe(true);
    for (const t of NON_CONTINUOUS_TYPES) expect(isContinuousSemantics(t)).toBe(false);
  });

  it("cautions rather than pretending Box-Cox is universal", () => {
    for (const t of NON_CONTINUOUS_TYPES) {
      const c = semanticsCaution(t)!;
      expect(c).toMatch(/Box-Cox is defined for a continuous positive response/i);
      expect(c).toMatch(/purpose-built model family/i);
    }
  });

  it("never suggests arcsine, log, sqrt or reciprocal as an automatic remedy", () => {
    const all = NON_CONTINUOUS_TYPES.map((t) => semanticsCaution(t)).join(" ");
    expect(all).not.toMatch(/arcsine|arcsin|square root|sqrt|reciprocal/i);
  });

  it("says nothing for continuous or unknown", () => {
    expect(semanticsCaution("continuous")).toBeNull();
    expect(semanticsCaution("unknown")).toBeNull();
  });
});

describe("exploration request", () => {
  const req = buildExplorationRequest({
    rawAnalysisToken: "raw-token-1", trait: "Yield", alpha: 0.05, responseType: "continuous",
  });

  it("is explicitly user initiated", () => {
    expect(req.user_initiated).toBe(true);
  });

  it("carries the exact raw identity, trait and alpha", () => {
    expect(req.analysis_token).toBe("raw-token-1");
    expect(req.trait).toBe("Yield");
    expect(req.inferential_alpha).toBe(0.05);
  });

  it("sends response metadata for exactly the requested trait", () => {
    expect(Object.keys(req.response_metadata)).toEqual(["Yield"]);
    expect(req.response_metadata.Yield.response_type).toBe("continuous");
  });
});

describe("Box-Cox display", () => {
  it("shows λ at full precision — 0.15 must not read as 0", () => {
    const l = readLambda({ ...ELIGIBLE_CANDIDATE, lambda: 0.15 })!;
    expect(l.lambdaText).toBe("0.1500");
    expect(l.lambdaText).not.toBe("0");
    const zero = readLambda(ELIGIBLE_CANDIDATE)!;
    expect(zero.lambdaText).toBe("0.0000");
    expect(zero.lambdaText).not.toBe(l.lambdaText);
  });

  it("names the transform only as the backend names it", () => {
    const l = readLambda(ELIGIBLE_CANDIDATE)!;
    expect(l.transform).toBe("box_cox");
    // The engine's own formula says log(x + 0); the client does not relabel.
    expect(l.formula).toBe("log(x + 0)");
  });

  it("shows search range, profile interval, shift and exactness", () => {
    const l = readLambda(ELIGIBLE_CANDIDATE)!;
    expect(l.searchRange).toContain("-2.00 to 2.00");
    expect(l.profileInterval).toBe("-0.2000 to 0.2000");
    expect(l.shift).toBe(0);
    expect(l.confidenceLevel).toBe(0.95);
    expect(l.exactness).toBe("exact");
  });

  it("surfaces boundary and truncation flags with their warnings", () => {
    const l = readLambda(INELIGIBLE_CANDIDATE)!;
    expect(l.boundaryHit).toBe(true);
    expect(l.intervalTruncated).toBe(true);
    expect(l.warnings).toHaveLength(2);
    expect(l.warnings[0]).toMatch(/search boundary/i);
  });

  it("returns nothing for an absent candidate", () => {
    expect(readLambda(null)).toBeNull();
  });
});

describe("boundary / truncation governance", () => {
  it("blocks selection when the backend says ineligible", () => {
    const gate = readSelectionGate(
      exploration(INELIGIBLE_CANDIDATE, false, [
        "lambda_optimum_on_search_boundary",
        "profile_interval_truncated",
      ])
    );
    expect(gate.selectable).toBe(false);
    expect(gate.status).toBe("ineligible_for_selection");
    expect(gate.blockedExplanation).toMatch(/not a stable basis for governed selection/i);
    expect(gate.blockedExplanation).toMatch(/raw analysis remains authoritative/i);
    expect(gate.blockedExplanation).toMatch(/edge of the evaluated grid/i);
  });

  it("permits selection when the backend says eligible", () => {
    const gate = readSelectionGate(exploration(ELIGIBLE_CANDIDATE, true));
    expect(gate.selectable).toBe(true);
    expect(gate.blockedExplanation).toBeNull();
  });

  it("never overrides the backend block", () => {
    // Even with no reasons listed, an ineligible status must not become selectable.
    expect(readSelectionGate(exploration(ELIGIBLE_CANDIDATE, false)).selectable).toBe(false);
  });
});

describe("authority states", () => {
  it("distinguishes the three states", () => {
    expect(authorityLabel("raw_primary")).toBe("Raw analysis — primary");
    expect(authorityLabel("explored_not_selected")).toBe("Transformation explored — not selected");
    expect(authorityLabel("transformed_selected")).toBe("Transformed analysis selected for inference");
  });

  it("says explicitly that exploration alone changes nothing", () => {
    const d = authorityDetail("explored_not_selected");
    expect(d).toMatch(/NOT adopted/);
    expect(d).toMatch(/still carries inferential authority/i);
    expect(d).toMatch(/ANOVA, mean separation and report above are unchanged/i);
  });

  it("keeps the raw branch available after selection", () => {
    expect(authorityDetail("transformed_selected")).toMatch(/raw analysis remains available/i);
  });
});

describe("selection request", () => {
  const expl = exploration(ELIGIBLE_CANDIDATE, true);

  it("requires the exact selection action string", () => {
    expect(buildSelectionRequest(expl).selection_action).toBe(SELECTION_ACTION);
    expect(SELECTION_ACTION).toBe("Use this transformed analysis for inferential reporting");
  });

  it("is explicitly user selected", () => {
    expect(buildSelectionRequest(expl).user_selected).toBe(true);
  });

  it("carries both identities, the trait, alpha and the reviewed model frame", () => {
    const r = buildSelectionRequest(expl);
    expect(r.raw_analysis_token).toBe("raw-token-1");
    expect(r.transformed_branch_token).toBe("branch-token-1");
    expect(r.trait).toBe("Yield");
    expect(r.inferential_alpha).toBe(0.05);
    expect(r.model_frame_identity).toBe(expl.model_frame_identity);
  });

  it("omits acknowledgement fields when none is required", () => {
    const r = buildSelectionRequest(expl);
    expect(r.diagnostic_concern_acknowledged).toBeUndefined();
    expect(r.diagnostic_concern_acknowledgement).toBeUndefined();
  });

  it("includes the acknowledgement text when concerns remain", () => {
    const r = buildSelectionRequest(expl, "I acknowledge that diagnostic concerns remain");
    expect(r.diagnostic_concern_acknowledged).toBe(true);
    expect(r.diagnostic_concern_acknowledgement).toMatch(/concerns remain/i);
  });
});

describe("diagnostics and selection wording", () => {
  it("never claims a transformation solved the assumptions", () => {
    const all = `${TRANSFORMED_DIAGNOSTICS_NOTE} ${SELECTION_MEANING_NOTE}`;
    expect(all).not.toMatch(
      /solved the assumptions|diagnostics now pass|transformed data are valid|fixed normality|assumptions? (passed|satisfied|resolved by)/i
    );
  });

  it("says the changed evidence does not by itself prove preference", () => {
    expect(TRANSFORMED_DIAGNOSTICS_NOTE).toMatch(
      /does not by itself prove that the transformed analysis is preferable/i
    );
  });

  it("keeps the scientific meaning of selection intact", () => {
    expect(SELECTION_MEANING_NOTE).toMatch(/does not assert that the model assumptions have been resolved/i);
  });
});

// ── Selected branch ──────────────────────────────────────────────────────────

const selected = (over: Partial<SelectedTransformedAnalysis> = {}): SelectedTransformedAnalysis =>
  ({
    selected_analysis_token: "selected-token-1",
    parent_raw_analysis_token: "raw-identity-1",
    parent_transformed_branch_token: "branch-token-1",
    dataset_token: "ds-1",
    model_frame_identity: "sha256:" + "a".repeat(64),
    trait: "Yield",
    original_trait: "Yield",
    sanitized_trait: "Yield",
    response_semantics: { response_type: "continuous" },
    inferential_alpha: 0.05,
    diagnostic_alpha: 0.05,
    authority_state: "transformed_selected_for_inference",
    previous_authority_state: "transformed_explored_not_selected",
    transformation: ELIGIBLE_CANDIDATE,
    model_contract: {},
    transformed_anova: {},
    treatment_decision: { estimable: true, significant: true, p_value: 1.98e-11, alpha: 0.05 },
    residual_ms: 0.00076906230542,
    residual_df: 9,
    tukey_result: {
      genotype: ["T4", "T3", "T2", "T1"],
      mean: [4.1385, 3.9482, 3.476, 3.2475],
      se: [0.0139, 0.0139, 0.0139, 0.0139],
      group: ["a", "b", "c", "d"],
      test: "Tukey HSD", alpha: 0.05,
    },
    tukey_status: {
      method: "Tukey HSD", alpha: 0.05, status: "success",
      means_provenance: "Transformed-scale model estimates from the selected complete RCBD Box-Cox model.",
    },
    transformed_scale_estimates: [],
    back_transformed_estimates: [
      {
        treatment: "T1", estimate: 25.7259444484,
        confidence_interval: [24.9315221853, 26.5456803176],
        scale_label: "Back-transformed model estimate",
        interval_method: "Inverse-transformed endpoints of the transformed-scale 95% interval; no bias correction",
      },
    ],
    transformed_diagnostics: {},
    effective_n: 16,
    observation_accounting: {},
    warnings: [],
    acknowledgements: [],
    interpretation: "",
    created_at: "", selected_at: "",
    version_provenance: {},
    selected_report_contract_version: "phase_3b2_selected_report_v1",
    ...over,
  }) as unknown as SelectedTransformedAnalysis;

describe("selected transformed branch", () => {
  const b = readSelectedBranch(selected())!;

  it("has its own distinct identity", () => {
    expect(b.token).toBe("selected-token-1");
    expect(b.token).not.toBe("raw-token-1");
    expect(b.token).not.toBe("branch-token-1");
  });

  it("uses the transformed branch's own Tukey letters, not raw letters", () => {
    expect(b.tukeyRows.map((r) => r.level)).toEqual(["T4", "T3", "T2", "T1"]);
    expect(b.tukeyRows.map((r) => r.group)).toEqual(["a", "b", "c", "d"]);
    // Raw letters were only two levels — a mix-up would be visible.
    expect(b.tukeyRows).toHaveLength(4);
  });

  it("labels the transformed means by their own provenance", () => {
    expect(b.tukeyMeansProvenance).toMatch(/Transformed-scale model estimates/i);
  });

  it("gates the transformed Tukey on the transformed branch's own decision and α", () => {
    expect(b.tukeyStatus).toBe("success");
    expect(b.decisionSignificant).toBe(true);
    expect(b.alpha).toBe(0.05);
    expect(b.residualDf).toBe(9);
  });

  it("labels back-transformed values as model estimates, never as raw or original means", () => {
    const est = b.backTransformed[0];
    expect(est.scaleLabel).toBe("Back-transformed model estimate");
    expect(est.scaleLabel).not.toMatch(/original mean|raw mean/i);
    expect(est.intervalMethod).toMatch(/no bias correction/i);
  });

  it("keeps the diagnostic α separate from the inferential α", () => {
    const alt = readSelectedBranch(selected({ inferential_alpha: 0.1 }))!;
    expect(alt.alpha).toBe(0.1);
    expect(alt.diagnosticAlpha).toBe(0.05);
  });

  it("returns nothing when nothing is selected", () => {
    expect(readSelectedBranch(null)).toBeNull();
  });
});

// ── Raw immutability ─────────────────────────────────────────────────────────

describe("raw analysis immutability", () => {
  const response = {
    summary_table: [],
    trait_results: {
      Yield: { status: "success", analysis_result: { result: rawResult() }, error: null, data_warnings: [] },
      Height: { status: "success", analysis_result: { result: rawResult() }, error: null, data_warnings: [] },
    },
    dataset_summary: { n_genotypes: 4, n_reps: 4, n_traits: 2, mode: "single" },
    failed_traits: [],
    export_token: "raw-token-1",
  } as unknown as UploadAnalysisResponse;

  it("exploration does not alter the raw decision, Tukey or export token", () => {
    const before = snapshotRaw(response, "Yield");
    // Exploration and selection are pure reads of the response; building their
    // requests must not touch it.
    buildExplorationRequest({ rawAnalysisToken: "raw-token-1", trait: "Yield", alpha: 0.05 });
    buildSelectionRequest(exploration(ELIGIBLE_CANDIDATE, true));
    const after = snapshotRaw(response, "Yield");
    expect(rawSnapshotsEqual(before, after)).toBe(true);
    expect(after!.exportToken).toBe("raw-token-1");
    expect(after!.tukeyGroups).toEqual(["a", "b"]);
  });

  it("selection creates a distinct identity from the raw token", () => {
    const b = readSelectedBranch(selected())!;
    expect(b.token).not.toBe(response.export_token);
  });

  it("multi-trait: selecting for one trait leaves the other's raw result intact", () => {
    const before = snapshotRaw(response, "Height");
    readSelectedBranch(selected({ trait: "Yield" }));
    const after = snapshotRaw(response, "Height");
    expect(rawSnapshotsEqual(before, after)).toBe(true);
  });

  it("exploration requests are trait-specific", () => {
    const y = buildExplorationRequest({ rawAnalysisToken: "raw-token-1", trait: "Yield", alpha: 0.05 });
    const h = buildExplorationRequest({ rawAnalysisToken: "raw-token-1", trait: "Height", alpha: 0.05 });
    expect(Object.keys(y.response_metadata)).toEqual(["Yield"]);
    expect(Object.keys(h.response_metadata)).toEqual(["Height"]);
    expect(y.trait).not.toBe(h.trait);
  });
});

// ── Identity failures ────────────────────────────────────────────────────────

describe("identity failure handling", () => {
  it("explains a model-frame mismatch as needing re-exploration", () => {
    const m = describeTransformationFailure(
      "Trait or model-frame identity does not match the transformed branch."
    );
    expect(m).toMatch(/no longer matches the analysis it was explored from/i);
    expect(m).toMatch(/Re-run the exploration/i);
  });

  it("explains a stale selected-analysis token", () => {
    const m = describeTransformationFailure("The exact selected analysis is unavailable or expired.");
    expect(m).toMatch(/no longer available for secure export/i);
    expect(m).toMatch(/re-select it/i);
    expect(m).toMatch(/no substitute report will be produced/i);
  });

  it("explains a backend refusal to select an ineligible branch", () => {
    const m = describeTransformationFailure(
      "This transformed branch is not eligible for inferential selection."
    );
    expect(m).toMatch(/did not identify a stable transformation/i);
    expect(m).toMatch(/raw analysis remains authoritative/i);
  });

  it("explains a stale raw token", () => {
    expect(
      describeTransformationFailure("The original analysis result is no longer available for secure export.")
    ).toMatch(/rerun the analysis/i);
  });

  it("never offers a repair or a fallback to another analysis", () => {
    const all = [
      "Trait or model-frame identity does not match the transformed branch.",
      "The exact selected analysis is unavailable or expired.",
      "token expired",
    ].map(describeTransformationFailure).join(" ");
    expect(all).not.toMatch(/we will use|falling back|another cached|reconstruct|repair/i);
  });

  it("passes an unrecognised message through rather than inventing a reason", () => {
    expect(describeTransformationFailure("Some novel backend failure")).toBe("Some novel backend failure");
  });
});
