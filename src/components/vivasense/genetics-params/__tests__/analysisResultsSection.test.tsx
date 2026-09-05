/**
 * W1-INT-06 — rendering-truthfulness bypass tests.
 *
 * These are independent of, and do not rely on, the installation gate
 * (analysisIdentity.test.ts covers that separately). Here an
 * `AnalysisResult` bound to one design is rendered directly — there is no
 * "live form state" prop on `AnalysisResultsSection` at all, so there is
 * nothing for a since-changed design tab to leak through. This is a
 * structural guarantee, not merely a remembered discipline: the component
 * signature makes the original defect (a result rendering under
 * "Completely Randomized Design (CRD)" / "CRD has no blocking term" while
 * the backend actually fitted and reported a significant RCBD block effect)
 * impossible to reintroduce without also changing this component's props.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AnalysisResultsSection } from "../AnovaModulePanel";
import type { AnalysisResult, AnalysisContext } from "../analysisIdentity";
import type {
  GeneticsResult,
  TreatmentDecision,
  UploadAnalysisResponse,
} from "@/services/geneticsUploadApi";

afterEach(cleanup);

const decision = (over: Partial<TreatmentDecision> = {}): TreatmentDecision => ({
  estimable: true,
  significant: true,
  p_value: 0.0000001,
  alpha: 0.05,
  ...over,
});

const geneticsResult = (over: Partial<GeneticsResult> = {}): GeneticsResult =>
  ({
    environment_mode: "single",
    n_genotypes: 18,
    n_reps: 3,
    n_environments: null,
    grand_mean: 100,
    variance_components: {},
    treatment_decision: decision(),
    anova_table: { source: ["rep", "genotype", "Residuals"], df: [2, 17, 34] },
    ...over,
  }) as GeneticsResult;

function buildResponse(over: Partial<UploadAnalysisResponse> = {}): UploadAnalysisResponse {
  return {
    summary_table: [],
    trait_results: {
      Yield_kg: {
        status: "success",
        analysis_result: {
          status: "SUCCESS",
          mode: "single",
          data_validation: {},
          variance_warnings: {},
          result: geneticsResult(),
          interpretation: "The Genotype effect was significant.",
        },
        error: null,
        data_warnings: [],
      },
    },
    dataset_summary: { n_genotypes: 18, n_reps: 3, n_traits: 1, mode: "single" },
    failed_traits: [],
    export_token: "export-abc",
    ...over,
  } as UploadAnalysisResponse;
}

function buildRcbdResult(): AnalysisResult<UploadAnalysisResponse> {
  const context: AnalysisContext = {
    requestId: 1,
    dispatchedAt: Date.now(),
    datasetToken: "ds-1",
    design: "rcbd",
    mapping: { treatment: "Genotype", rep: "Rep" },
    selectedTraits: ["Yield_kg"],
    responseSemantics: {},
    alpha: 0.05,
    module: "anova",
    mode: "single",
  };
  return { response: buildResponse(), context };
}

const noop = () => {};

describe("W1-INT-06 — same-family rendering-truthfulness bypass (RCBD result, live form forced to CRD)", () => {
  it("renders the RCBD label and never inherits the CRD-family label from anywhere else", () => {
    const analysisResult = buildRcbdResult();

    // There is deliberately no prop through which a "live design" of "crd"
    // could be supplied here — this IS the bypass: even if some other part
    // of the tree has since moved on to CRD, this component was never given
    // a channel to read it.
    render(<AnalysisResultsSection
      analysisResult={analysisResult}
      transformChoice="raw"
      onTransformChoiceChange={noop}
      showTransformWhy={false}
      onToggleTransformWhy={noop}
      exportError={null}
      isDownloading={false}
      onDownload={noop}
    />);

    expect(screen.getByText(/ANOVA Results — Randomized Complete Block Design \(RCBD\)/i)).toBeTruthy();
    expect(screen.queryByText(/Completely Randomized Design \(CRD\)/i)).toBeNull();
    expect(screen.queryByText(/CRD has no blocking term/i)).toBeNull();
  });

  it("passes the RCBD-bound mapping (Genotype/Rep), not any other value, to the governed panel", () => {
    const analysisResult = buildRcbdResult();
    render(<AnalysisResultsSection
      analysisResult={analysisResult}
      transformChoice="raw"
      onTransformChoiceChange={noop}
      showTransformWhy={false}
      onToggleTransformWhy={noop}
      exportError={null}
      isDownloading={false}
      onDownload={noop}
    />);
    // GovernedOneFactorPanel's summary states the treatment/rep columns by
    // name (via buildDesignSummary) — Genotype/Rep must appear, since that
    // is what analysisResult.context.mapping actually says.
    expect(screen.getAllByText(/Genotype/).length).toBeGreaterThan(0);
  });
});

describe("W1-INT-06 — cross-family rendering-truthfulness bypass (RCBD result, live form forced to Factorial CRD)", () => {
  it("still renders the governed ONE-FACTOR presentation from the bound RCBD context, not a Factorial or bare fallback", () => {
    const analysisResult = buildRcbdResult(); // context.design stays "rcbd" regardless of anything else in the app

    render(<AnalysisResultsSection
      analysisResult={analysisResult}
      transformChoice="raw"
      onTransformChoiceChange={noop}
      showTransformWhy={false}
      onToggleTransformWhy={noop}
      exportError={null}
      isDownloading={false}
      onDownload={noop}
    />);

    // The governed one-factor panel's own heading must be present...
    expect(screen.getByText(/Design and analysis summary/i)).toBeTruthy();
    expect(screen.getByText(/ANOVA Results — Randomized Complete Block Design \(RCBD\)/i)).toBeTruthy();
    // ...and nothing anywhere claims a Factorial or CRD family for this result.
    expect(screen.queryByText(/Factorial/i)).toBeNull();
    expect(screen.queryByText(/Completely Randomized Design \(CRD\)/i)).toBeNull();
  });
});
