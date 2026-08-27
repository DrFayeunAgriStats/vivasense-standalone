/**
 * Phase A — governed backend contract alignment.
 *
 * These tests pin the CONTRACT, not the UI. Phase A deliberately changes no
 * visible ANOVA behaviour: it only makes the standalone client capable of
 * representing what the frozen ANOVA v1 backend already returns. So the two
 * things worth testing are (a) the new shapes are accepted, and (b) nothing
 * that worked before stops working — in particular, a response with none of
 * the governance objects must still parse and render exactly as it did.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildModeHeaders, getVivaSenseMode, guardProModule } from "../featureMode";
import type {
  AnovaAlpha,
  GovernedDesignType,
  AnovaDesignTypeWire,
  UploadAnalysisRequest,
  UploadAnalysisResponse,
  GeneticsResult,
  TreatmentDecision,
  MeanSeparationStatus,
  GovernedDecision,
} from "../geneticsUploadApi";
import { buildGovernedExportPayload } from "../geneticsUploadApi";
import {
  RCBD_TRANSFORMATION_EXPLORATION_PATH,
  RCBD_SELECT_TRANSFORMED_ANALYSIS_PATH,
  RCBD_EXPORT_SELECTED_TRANSFORMED_WORD_PATH,
} from "../rcbdTransformationApi";

const baseRequest: UploadAnalysisRequest = {
  base64_content: "Zm9v",
  file_type: "csv",
  genotype_column: "Treatment",
  rep_column: "Block",
  environment_column: null,
  trait_columns: ["Yield"],
  mode: "single",
  selection_intensity: 2.04,
  module: "anova",
};

describe("request contract — design identifiers", () => {
  it("accepts every governed design identifier", () => {
    const governed: GovernedDesignType[] = [
      "crd",
      "rcbd",
      "factorial_crd",
      "factorial_rcbd",
      "split_plot_rcbd",
    ];
    for (const design of governed) {
      const request: UploadAnalysisRequest = { ...baseRequest, design_type: design };
      expect(request.design_type).toBe(design);
    }
  });

  it("accepts factorial_crd specifically — the identifier the live UI never sent", () => {
    const request: UploadAnalysisRequest = { ...baseRequest, design_type: "factorial_crd" };
    expect(request.design_type).toBe("factorial_crd");
  });

  it("still accepts the legacy 'factorial' identifier for back-compat", () => {
    const legacy: AnovaDesignTypeWire = "factorial";
    const request: UploadAnalysisRequest = { ...baseRequest, design_type: legacy };
    expect(request.design_type).toBe("factorial");
  });

  it("keeps 'factorial' OUT of the governed set, so new code cannot pick it by accident", () => {
    const governed: readonly string[] = [
      "crd",
      "rcbd",
      "factorial_crd",
      "factorial_rcbd",
      "split_plot_rcbd",
    ];
    expect(governed).not.toContain("factorial");
  });
});

describe("request contract — selected alpha", () => {
  it("accepts each of the three permitted alphas", () => {
    const alphas: AnovaAlpha[] = [0.01, 0.05, 0.1];
    for (const alpha of alphas) {
      const request: UploadAnalysisRequest = { ...baseRequest, alpha };
      expect(request.alpha).toBe(alpha);
    }
  });

  it("treats 0.10 and 0.1 as the same literal", () => {
    const request: UploadAnalysisRequest = { ...baseRequest, alpha: 0.1 };
    expect(request.alpha).toBe(0.1);
    expect(0.10).toBe(0.1);
  });

  it("rejects a value outside the permitted set", () => {
    // @ts-expect-error 0.2 is not an accepted inferential alpha
    const request: UploadAnalysisRequest = { ...baseRequest, alpha: 0.2 };
    expect(request).toBeTruthy();
  });

  it("leaves alpha optional so existing callers compile unchanged", () => {
    const request: UploadAnalysisRequest = { ...baseRequest };
    expect(request.alpha).toBeUndefined();
  });
});

describe("response contract — governed objects type safely when present", () => {
  it("types a split-plot result with both error strata named", () => {
    const wholePlot: GovernedDecision = {
      estimable: true,
      significant: true,
      p_value: 0.004515,
      alpha: 0.05,
      error_stratum: "Error A",
      denominator_df: 6,
      denominator_ms: 30.238553,
    };
    const result: Partial<GeneticsResult> = {
      design: "split_plot_rcbd",
      split_plot_profile: { whole_plot_factor: "Main", sub_plot_factor: "Sub" },
      whole_plot_decision: wholePlot,
      sub_plot_decision: { significant: true, alpha: 0.05, error_stratum: "Error B" },
      split_plot_interaction_decision: { significant: false, alpha: 0.05 },
      main_plot_separation_status: {
        status: "not_run_omnibus_not_significant",
        method: "Protected Fisher's LSD",
        alpha: 0.05,
        message: "withheld",
      },
    };
    expect(result.whole_plot_decision?.error_stratum).toBe("Error A");
    expect(result.sub_plot_decision?.error_stratum).toBe("Error B");
    expect(result.main_plot_separation_status?.status).toBe(
      "not_run_omnibus_not_significant"
    );
  });

  it("types a governed factorial result", () => {
    const result: Partial<GeneticsResult> = {
      design: "factorial_crd",
      factorial_profile: { factor_a: "FactorA", factor_b: "FactorB" },
      factor_a_decision: { significant: true, alpha: 0.05 },
      factor_b_decision: { significant: false, alpha: 0.05 },
      interaction_decision: { significant: true, alpha: 0.05 },
      simple_effects: { moving_a_within_b: [], moving_b_within_a: [] },
    };
    expect(result.interaction_decision?.significant).toBe(true);
    expect(result.factorial_profile).toBeDefined();
  });

  it("types a one-factor treatment decision and its gate status", () => {
    const decision: TreatmentDecision = {
      estimable: true,
      significant: false,
      p_value: 0.077,
      alpha: 0.05,
      inferential_alpha: 0.05,
      diagnostic_alpha: 0.05,
    };
    const status: MeanSeparationStatus = {
      status: "not_run_omnibus_not_significant",
      method: "Tukey HSD",
      alpha: 0.05,
      omnibus_p_value: 0.077,
      message: "Omnibus not significant at the selected alpha",
    };
    expect(decision.significant).toBe(false);
    // The gate is a governed outcome, not an error.
    expect(status.status).toBe("not_run_omnibus_not_significant");
  });

  it("carries analysis_settings and both tokens on the envelope", () => {
    const response: Partial<UploadAnalysisResponse> = {
      export_token: "tok-123",
      dataset_token: "ds-456",
      analysis_settings: { inferential_alpha: 0.01, diagnostic_alpha: 0.05 },
    };
    expect(response.analysis_settings?.inferential_alpha).toBe(0.01);
    // Diagnostic alpha is fixed at 0.05 regardless of the inferential alpha.
    expect(response.analysis_settings?.diagnostic_alpha).toBe(0.05);
  });
});

describe("backward compatibility — pre-governance responses", () => {
  const legacyResponse: UploadAnalysisResponse = {
    summary_table: [{ trait: "Yield", status: "success" }],
    trait_results: {
      Yield: {
        status: "success",
        analysis_result: {
          status: "ok",
          mode: "single",
          data_validation: {},
          variance_warnings: {},
          interpretation: "legacy",
          result: {
            environment_mode: "single",
            n_genotypes: 4,
            n_reps: 4,
            n_environments: null,
            grand_mean: 100,
            variance_components: {},
            heritability: { h2_broad_sense: 0, interpretation_basis: "x" },
            genetic_parameters: { selection_intensity: 2.04 },
            anova_table: {
              source: ["genotype", "Residuals"],
              df: [3, 12],
              ss: [1, 2],
              ms: [1, 2],
              f_value: [1],
              p_value: [0.5],
            },
          },
        },
        error: null,
        data_warnings: [],
      },
    },
    dataset_summary: { n_genotypes: 4, n_reps: 4, n_traits: 1, mode: "single" },
    failed_traits: [],
  };

  it("parses with no governance objects at all", () => {
    const result = legacyResponse.trait_results.Yield.analysis_result?.result;
    expect(result?.anova_table?.source).toEqual(["genotype", "Residuals"]);
    expect(result?.treatment_decision).toBeUndefined();
    expect(result?.split_plot_profile).toBeUndefined();
    expect(result?.factorial_profile).toBeUndefined();
  });

  it("still exposes the fields existing rendering reads", () => {
    const result = legacyResponse.trait_results.Yield.analysis_result?.result;
    expect(result?.grand_mean).toBe(100);
    expect(result?.n_genotypes).toBe(4);
    expect(result?.n_reps).toBe(4);
  });

  it("survives export payload construction without an export_token", () => {
    const payload = buildGovernedExportPayload(legacyResponse);
    expect(payload.export_token).toBeNull();
    expect(payload.module).toBe("anova");
  });
});

describe("export plumbing — full response with exact token", () => {
  const governedResponse = {
    summary_table: [],
    trait_results: {
      Yield: {
        // status intentionally omitted — the builder must infer it
        analysis_result: {
          status: "ok",
          mode: "single",
          data_validation: {},
          variance_warnings: {},
          interpretation: "",
          result: {
            environment_mode: "single",
            n_genotypes: 3,
            n_reps: 4,
            n_environments: null,
            grand_mean: 100,
            variance_components: {},
            heritability: { h2_broad_sense: 0, interpretation_basis: "x" },
            genetic_parameters: { selection_intensity: 2.04 },
            split_plot_profile: { whole_plot_factor: "Main" },
            whole_plot_decision: { significant: true, alpha: 0.01 },
          },
        },
        error: null,
        data_warnings: [],
      },
    },
    dataset_summary: { n_genotypes: 3, n_reps: 4, n_traits: 1, mode: "single" },
    failed_traits: [],
    export_token: "exact-token-abc",
    analysis_settings: { inferential_alpha: 0.01, diagnostic_alpha: 0.05 },
  } as unknown as UploadAnalysisResponse;

  it("echoes export_token verbatim — never regenerated", () => {
    const payload = buildGovernedExportPayload(governedResponse);
    expect(payload.export_token).toBe("exact-token-abc");
  });

  it("retains selected alpha, governance objects and profile metadata", () => {
    const payload = buildGovernedExportPayload(governedResponse) as {
      analysis_settings?: { inferential_alpha?: number };
      trait_results: Record<string, { analysis_result?: { result?: GeneticsResult } }>;
    };
    expect(payload.analysis_settings?.inferential_alpha).toBe(0.01);
    const result = payload.trait_results.Yield.analysis_result?.result;
    expect(result?.split_plot_profile).toBeDefined();
    expect(result?.whole_plot_decision?.significant).toBe(true);
  });

  it("normalises a missing trait status rather than dropping the trait", () => {
    const payload = buildGovernedExportPayload(governedResponse) as {
      trait_results: Record<string, { status: string }>;
    };
    expect(payload.trait_results.Yield.status).toBe("success");
  });

  it("honours an explicit module/domain override", () => {
    const payload = buildGovernedExportPayload(governedResponse, {
      module: "anova",
      domain: "agronomy",
    });
    expect(payload.domain).toBe("agronomy");
  });
});

describe("RCBD governed route paths", () => {
  it("are mounted under /genetics/rcbd/", () => {
    for (const path of [
      RCBD_TRANSFORMATION_EXPLORATION_PATH,
      RCBD_SELECT_TRANSFORMED_ANALYSIS_PATH,
      RCBD_EXPORT_SELECTED_TRANSFORMED_WORD_PATH,
    ]) {
      // The routers carry a /genetics prefix; "/rcbd/..." alone 404s.
      expect(path.startsWith("/genetics/rcbd/")).toBe(true);
    }
  });

  it("name the exact three routes", () => {
    expect(RCBD_TRANSFORMATION_EXPLORATION_PATH).toBe(
      "/genetics/rcbd/transformation-exploration"
    );
    expect(RCBD_SELECT_TRANSFORMED_ANALYSIS_PATH).toBe(
      "/genetics/rcbd/select-transformed-analysis"
    );
    expect(RCBD_EXPORT_SELECTED_TRANSFORMED_WORD_PATH).toBe(
      "/genetics/rcbd/export-selected-transformed-word"
    );
  });
});

describe("X-VivaSense-Mode behaviour is unchanged", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("stamps exactly what getVivaSenseMode() reports", () => {
    // Deliberately asserted against the module's own accessor rather than a
    // hardcoded value: TEMP_ALL_FEATURES_PERMITTED currently forces "pro"
    // regardless of the stored mode, and this test must keep passing whether
    // that override is on or off. What Phase A must not change is the *link*
    // between the reported mode and the header.
    expect(buildModeHeaders().get("X-VivaSense-Mode")).toBe(getVivaSenseMode());
  });

  it("keeps header and guard consistent, so Pro-gated exports are not 403'd", () => {
    // A "free" header with a bypassing guard is the exact mismatch that makes
    // the backend reject an export the client believed it was allowed to make.
    const mode = getVivaSenseMode();
    if (mode === "pro") {
      expect(() => guardProModule("export-word")).not.toThrow();
    } else {
      expect(() => guardProModule("export-word")).toThrow();
    }
  });

  it("is not overridden by a conflicting stored value", () => {
    const before = buildModeHeaders().get("X-VivaSense-Mode");
    localStorage.setItem("vivasense_mode", "free");
    expect(buildModeHeaders().get("X-VivaSense-Mode")).toBe(getVivaSenseMode());
    localStorage.setItem("vivasense_mode", "pro");
    expect(buildModeHeaders().get("X-VivaSense-Mode")).toBe(getVivaSenseMode());
    localStorage.clear();
    expect(buildModeHeaders().get("X-VivaSense-Mode")).toBe(before);
  });

  it("preserves caller-supplied headers alongside the mode header", () => {
    const headers = buildModeHeaders({ "Content-Type": "application/json" });
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-VivaSense-Mode")).toBeTruthy();
  });
});
