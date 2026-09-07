/**
 * W1-INT-09 — permanent adversarial regression: W1-INT-06's result-binding
 * guarantee must hold across a dataset-instance swap even when neither
 * dataset carries an operational `datasetToken` (both `null`).
 *
 * Before this ticket, W1-INT-06's `canonicalAnalysisFingerprint` used
 * `datasetToken` as its dataset-identity term. `null` and `undefined`
 * serialize identically via `JSON.stringify`, so two different token-less
 * datasets were indistinguishable to the fingerprint and to the dataset-sync
 * `useLayoutEffect`'s `token === current.datasetToken` guard (`null === null`
 * is `true`, so the effect never even fired). A stale in-flight response
 * computed under one dataset could install and render under a different,
 * later-selected dataset -- the same defect class W1-INT-06 was built to
 * prevent (RCBD/CRD mislabeling), now reachable via dataset identity instead
 * of design/mapping identity.
 *
 * The fix (W1-INT-09) replaces `datasetToken` with `datasetInstanceId` -- a
 * frontend-generated identity that is always a valid non-empty string,
 * independent of whether the backend issued a cache token. These four cases
 * are the load-bearing proof that a genuine dataset-instance change is always
 * detected regardless of `datasetToken`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/geneticsUploadApi", () => ({ downloadReport: vi.fn().mockResolvedValue(new Blob()) }));
const recordAnalysisFailureMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn().mockResolvedValue(undefined),
  recordAnalysisFailure: recordAnalysisFailureMock,
}));
const analyzeUploadMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/geneticsUploadApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/geneticsUploadApi")>();
  return { ...actual, analyzeUpload: analyzeUploadMock };
});
import { AnovaModulePanel } from "../AnovaModulePanel";

afterEach(() => {
  cleanup();
  analyzeUploadMock.mockReset();
  recordAnalysisFailureMock.mockReset().mockResolvedValue(undefined);
  toastMock.mockReset();
});

/**
 * Every dataset built here has `datasetToken: null` -- the whole point of
 * this file is that operational-token absence must never stand in for
 * dataset-identity absence. `datasetInstanceId` is the only thing that
 * differs between "the same dataset" and "a different dataset" below.
 */
function buildDataset(instanceId: string, over: Partial<DatasetContext> = {}): DatasetContext {
  return {
    file: new File(["content-for-" + instanceId], `${instanceId}.csv`),
    base64Content: "AAAA",
    fileType: "csv",
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    environmentColumn: null,
    availableTraitColumns: ["Yield_kg"],
    mode: "single",
    datasetToken: null,
    datasetInstanceId: instanceId,
    columns: ["Genotype", "Rep"],
    dataPreview: [
      { Genotype: "G01", Rep: "R1" },
      { Genotype: "G02", Rep: "R1" },
    ],
    ...over,
  } as DatasetContext;
}

function buildResponse(tag: string): UploadAnalysisResponse {
  return {
    summary_table: [],
    trait_results: {
      Yield_kg: {
        status: "success",
        analysis_result: {
          status: "SUCCESS", mode: "single", data_validation: {}, variance_warnings: {},
          result: {
            environment_mode: "single", n_genotypes: 18, n_reps: 3, n_environments: null,
            grand_mean: 100, variance_components: {},
            treatment_decision: { estimable: true, significant: true, p_value: 1e-7, alpha: 0.05 },
            anova_table: { source: [tag, "Residuals"], df: [17, 34] },
          } as any,
          interpretation: `result-for-${tag}`,
        },
        error: null, data_warnings: [],
      },
    },
    dataset_summary: { n_genotypes: 18, n_reps: 3, n_traits: 1, mode: "single" },
    failed_traits: [], export_token: `tok-${tag}`,
  } as UploadAnalysisResponse;
}

async function mapAndSelectTrait() {
  const combos = screen.getAllByRole("combobox");
  fireEvent.click(combos[0]);
  fireEvent.click(await screen.findByRole("option", { name: "Genotype" }));
  fireEvent.click(screen.getAllByRole("combobox")[1]);
  fireEvent.click(await screen.findByRole("option", { name: "Rep" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
  fireEvent.click(screen.getByRole("button", { name: /Confirm experimental roles/i }));
}

describe("W1-INT-09 — W1-INT-06 dataset-instance adversarial regression (token-less)", () => {
  it("CASE 1 — in-flight: a Dataset-A response resolving after swap to Dataset B must NOT install", async () => {
    let resolveAnalyze: (v: UploadAnalysisResponse) => void = () => {};
    analyzeUploadMock.mockImplementation(
      () => new Promise<UploadAnalysisResponse>((resolve) => { resolveAnalyze = resolve; })
    );

    const datasetA = buildDataset("instance-A");
    const { rerender } = render(<AnovaModulePanel datasetContext={datasetA} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /^Run Analysis$/i }));
    expect(analyzeUploadMock).toHaveBeenCalledTimes(1);

    const datasetB = buildDataset("instance-B", {
      dataPreview: [{ Genotype: "ZZ99", Rep: "BLOCK-X" }],
    });
    rerender(<AnovaModulePanel datasetContext={datasetB} />);

    await act(async () => { resolveAnalyze(buildResponse("DATASET-A-RESULT")); });

    expect(screen.queryByText(/ANOVA Results/i)).toBeNull();
    expect(screen.queryByText(/result-for-DATASET-A-RESULT/i)).toBeNull();
  });

  it("CASE 2 — installed result: an already-installed Dataset-A result must clear once Dataset B becomes current", async () => {
    analyzeUploadMock.mockResolvedValueOnce(buildResponse("A"));
    const datasetA = buildDataset("instance-A");
    const { rerender } = render(<AnovaModulePanel datasetContext={datasetA} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /^Run Analysis$/i }));
    await waitFor(() => expect(screen.getByText(/ANOVA Results/i)).toBeTruthy());

    const datasetB = buildDataset("instance-B", {
      dataPreview: [{ Genotype: "ZZ99", Rep: "BLOCK-X" }],
    });
    rerender(<AnovaModulePanel datasetContext={datasetB} />);

    expect(screen.queryByText(/ANOVA Results/i)).toBeNull();
  });

  it("CASE 3 — rapid replacement A -> B -> C: A's stale response must not install even after two intervening dataset swaps, and C's own subsequent dispatch must install correctly", async () => {
    // The real UI cannot hold two overlapping in-flight ANOVA requests from
    // one AnovaModulePanel instance: `isAnalyzing` disables Run/tabs/
    // checkboxes for the whole panel until the in-flight request resolves or
    // rejects, and a dataset-context swap alone does not reset it (only
    // `beginDispatch`/`invalidate` touch the identity controller's
    // generation counter, and a dataset swap uses neither). So the
    // realistic "rapid replacement" a researcher can actually trigger is:
    // dispatch on A, then swap the dataset TWICE in a row (B, then C)
    // before A's request ever resolves -- the UI stays locked throughout --
    // and only once A's stale response finally arrives (and is correctly
    // discarded) does the panel unlock for a fresh, real dispatch on
    // whichever dataset is current by then (C).
    let resolveA: (v: UploadAnalysisResponse) => void = () => {};
    analyzeUploadMock.mockImplementation(
      () => new Promise<UploadAnalysisResponse>((r) => { resolveA = r; })
    );

    const datasetA = buildDataset("instance-A");
    const { rerender } = render(<AnovaModulePanel datasetContext={datasetA} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /^Run Analysis$/i }));
    expect(analyzeUploadMock).toHaveBeenCalledTimes(1);

    const datasetB = buildDataset("instance-B", { dataPreview: [{ Genotype: "BB1", Rep: "R1" }] });
    rerender(<AnovaModulePanel datasetContext={datasetB} />);
    const datasetC = buildDataset("instance-C", { dataPreview: [{ Genotype: "CC1", Rep: "R1" }] });
    rerender(<AnovaModulePanel datasetContext={datasetC} />);

    // A's stale response finally arrives, after two intervening swaps.
    await act(async () => { resolveA(buildResponse("RESULT-A")); });
    expect(screen.queryByText(/result-for-RESULT-A/i)).toBeNull();
    expect(screen.queryByText(/ANOVA Results/i)).toBeNull();

    // The panel is now unlocked (A's request settled). Role/trait mapping
    // state persists across a dataset swap by design (switching datasets
    // does not clear the researcher's selections) -- only the confirmation
    // itself was consumed by the swaps, so only re-confirming (not
    // re-selecting) is needed before dispatching for real on the dataset
    // that is actually current -- Dataset C.
    analyzeUploadMock.mockResolvedValueOnce(buildResponse("RESULT-C"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm experimental roles/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Run Analysis$/i }));
    await waitFor(() => expect(screen.getByText(/result-for-RESULT-C/i)).toBeTruthy());
  });

  it("CASE 4 — old failure after replacement: a Dataset-A request failing after swap to Dataset B must not mutate Dataset-B's UI", async () => {
    let rejectA: (err: Error) => void = () => {};
    analyzeUploadMock.mockImplementation(
      () => new Promise<UploadAnalysisResponse>((_resolve, reject) => { rejectA = reject; })
    );

    const datasetA = buildDataset("instance-A");
    const { rerender } = render(<AnovaModulePanel datasetContext={datasetA} />);
    await mapAndSelectTrait();
    fireEvent.click(screen.getByRole("button", { name: /^Run Analysis$/i }));
    expect(analyzeUploadMock).toHaveBeenCalledTimes(1);

    const datasetB = buildDataset("instance-B", { dataPreview: [{ Genotype: "BB1", Rep: "R1" }] });
    rerender(<AnovaModulePanel datasetContext={datasetB} />);

    await act(async () => {
      rejectA(new Error("Dataset A's request failed after replacement"));
      // Allow the rejection's .catch handler to run.
      await Promise.resolve();
    });

    // Dataset A's failure is no longer "current" once Dataset B is active:
    // it must not be recorded to history or surfaced as a toast attributed
    // to whatever Dataset B's screen now shows. `isStillCurrent`'s fingerprint
    // check (keyed on datasetInstanceId) is what must reject it here -- the
    // generation counter alone does not, since a mere dataset-context swap
    // never calls `beginDispatch`/`invalidate`.
    expect(recordAnalysisFailureMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "ANOVA failed" })
    );
    expect(screen.queryByText(/ANOVA Results/i)).toBeNull();
  });
});
