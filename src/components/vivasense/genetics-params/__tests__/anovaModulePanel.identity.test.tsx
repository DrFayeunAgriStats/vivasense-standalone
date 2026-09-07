/**
 * W1-INT-06 — full-component integration tests for the analysis-result
 * identity contract, exercising the real `AnovaModulePanel.handleAnalyze`
 * async flow (not the standalone controller in isolation — see
 * analysisIdentity.test.ts for that).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/geneticsUploadApi", () => ({
  downloadReport: vi.fn().mockResolvedValue(new Blob()),
}));
vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn().mockResolvedValue(undefined),
  recordAnalysisFailure: vi.fn().mockResolvedValue(undefined),
}));

const analyzeUploadMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/geneticsUploadApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/geneticsUploadApi")>();
  return { ...actual, analyzeUpload: analyzeUploadMock };
});

// Imported AFTER the mocks above so the module picks them up.
import { AnovaModulePanel } from "../AnovaModulePanel";

afterEach(() => {
  cleanup();
  analyzeUploadMock.mockReset();
  URL.createObjectURL = vi.fn(() => "blob://mock");
  URL.revokeObjectURL = vi.fn();
});

function buildDataset(over: Partial<DatasetContext> = {}): DatasetContext {
  return {
    file: new File(["a"], "fixture.csv"),
    base64Content: "AAAA",
    fileType: "csv",
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    environmentColumn: null,
    availableTraitColumns: ["Yield_kg"],
    mode: "single",
    datasetInstanceId: "instance-1",
    datasetToken: "ds-1",
    columns: ["Genotype", "Rep", "OtherFactor"],
    dataPreview: [
      { Genotype: "G01", Rep: "R1", OtherFactor: "A" },
      { Genotype: "G01", Rep: "R2", OtherFactor: "B" },
      { Genotype: "G02", Rep: "R1", OtherFactor: "A" },
      { Genotype: "G02", Rep: "R2", OtherFactor: "B" },
    ],
    ...over,
  };
}

function buildResponse(designHint: "rcbd-shaped" | "crd-shaped" = "rcbd-shaped"): UploadAnalysisResponse {
  const anovaTable =
    designHint === "rcbd-shaped"
      ? { source: ["rep", "genotype", "Residuals"], df: [2, 17, 34] }
      : { source: ["genotype", "Residuals"], df: [17, 36] };
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
          result: {
            environment_mode: "single",
            n_genotypes: 18,
            n_reps: 3,
            n_environments: null,
            grand_mean: 100,
            variance_components: {},
            treatment_decision: { estimable: true, significant: true, p_value: 1e-7, alpha: 0.05 },
            anova_table: anovaTable,
          } as any,
          interpretation: "significant",
        },
        error: null,
        data_warnings: [],
      },
    },
    dataset_summary: { n_genotypes: 18, n_reps: 3, n_traits: 1, mode: "single" },
    failed_traits: [],
    export_token: "tok-1",
  } as UploadAnalysisResponse;
}

/** Selects Genotype for Treatment and Rep for Replication/Block on a freshly
 * rendered RCBD panel, checks the one available trait, then confirms the
 * experimental roles (W1-UI-04) so Run Analysis becomes enabled — mirroring
 * what every one of this suite's scenarios needs before it can exercise the
 * W1-INT-06 dispatch/install-gate behaviour that is actually under test
 * here. */
async function mapAndSelectTrait() {
  const combos = screen.getAllByRole("combobox");
  fireEvent.click(combos[0]);
  fireEvent.click(await screen.findByRole("option", { name: "Genotype" }));
  fireEvent.click(screen.getAllByRole("combobox")[1]);
  fireEvent.click(await screen.findByRole("option", { name: "Rep" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
  fireEvent.click(screen.getByRole("button", { name: /Confirm experimental roles/i }));
}

describe("W1-INT-06 — full-component installation gate control case", () => {
  it("a response that resolves with the scientific state genuinely unchanged DOES install (control case for the gate)", async () => {
    let resolveAnalyze: (v: UploadAnalysisResponse) => void = () => {};
    analyzeUploadMock.mockImplementation(
      () => new Promise<UploadAnalysisResponse>((resolve) => { resolveAnalyze = resolve; })
    );

    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await mapAndSelectTrait();

    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    expect(analyzeUploadMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAnalyze(buildResponse("rcbd-shaped"));
    });

    // Nothing about the scientific state changed between dispatch and
    // resolution, so the install gate must let this one through — proving
    // the gate does not over-block ordinary, uneventful analyses.
    await waitFor(() => expect(screen.getByText(/ANOVA Results/i)).toBeTruthy());
  });

  it("Run Analysis is disabled for the entire duration of an in-flight request", async () => {
    let resolveAnalyze: (v: UploadAnalysisResponse) => void = () => {};
    analyzeUploadMock.mockImplementation(
      () => new Promise<UploadAnalysisResponse>((resolve) => { resolveAnalyze = resolve; })
    );
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await mapAndSelectTrait();

    const runButton = screen.getByRole("button", { name: /Run Analysis/i });
    fireEvent.click(runButton);
    expect(runButton).toBeDisabled();

    await act(async () => {
      resolveAnalyze(buildResponse());
    });
    await waitFor(() => expect(runButton).not.toBeDisabled());
  });

  it("in-flight scientific controls (design tabs, alpha) are disabled while isAnalyzing is true", async () => {
    analyzeUploadMock.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));

    expect(screen.getByRole("tab", { name: "CRD" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /α = 0\.01/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Yield_kg/i })).toBeDisabled();
  });
});

describe("W1-INT-06 — post-result invalidation", () => {
  async function installAResult() {
    analyzeUploadMock.mockResolvedValueOnce(buildResponse());
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await waitFor(() => expect(screen.getByText(/ANOVA Results/i)).toBeTruthy());
  }

  it("changing design after a result exists clears the result and shows the rerun cue", async () => {
    await installAResult();
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "CRD" }));
    await waitFor(() => expect(screen.queryByText(/ANOVA Results/i)).toBeNull());
    expect(screen.getByText(/Analysis inputs changed\. Run the analysis again/i)).toBeTruthy();
  });

  it("changing alpha after a result exists clears the result", async () => {
    await installAResult();
    fireEvent.click(screen.getByRole("button", { name: /α = 0\.01/ }));
    await waitFor(() => expect(screen.queryByText(/ANOVA Results/i)).toBeNull());
  });

  it("export control disappears once the result is invalidated", async () => {
    await installAResult();
    expect(screen.getByRole("button", { name: /Download ANOVA Report/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "α = 0.10" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Download ANOVA Report/i })).toBeNull());
  });
});

describe("W1-INT-06 — dataset replacement", () => {
  it("a response tied to Dataset A cannot install once datasetContext has switched to Dataset B", async () => {
    let resolveAnalyze: (v: UploadAnalysisResponse) => void = () => {};
    analyzeUploadMock.mockImplementation(
      () => new Promise<UploadAnalysisResponse>((resolve) => { resolveAnalyze = resolve; })
    );
    const datasetA = buildDataset({ datasetInstanceId: "instance-A" });
    const { rerender } = render(<AnovaModulePanel datasetContext={datasetA} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    expect(analyzeUploadMock).toHaveBeenCalledTimes(1);

    // Replace the dataset prop entirely — a new datasetInstanceId (W1-INT-09;
    // this is what a genuine dataset swap is now keyed on, not datasetToken),
    // simulating an upload completing while the prior analysis is still in
    // flight.
    const datasetB = buildDataset({ datasetInstanceId: "instance-B", file: new File(["b"], "other.csv") });
    rerender(<AnovaModulePanel datasetContext={datasetB} />);

    await act(async () => {
      resolveAnalyze(buildResponse());
    });

    // The Dataset-A response must not present itself as belonging to the
    // now-current Dataset B.
    await waitFor(() => expect(analyzeUploadMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/ANOVA Results/i)).toBeNull();
  });
});
