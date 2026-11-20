/**
 * Audit finding: ANOVA & Mean Separation result identity.
 *
 * Reproduction: complete an RCBD run, then click the CRD design tab. Before the
 * fix the RCBD result was relabelled "ANOVA Results — Completely Randomized
 * Design (CRD)" and its report stayed downloadable under a CRD filename.
 *
 * Fix contract tested here:
 *   - the heading, export route and filename come from the completed run;
 *   - changing dataset, design, mapping, response variables or alpha clears the
 *     result and removes its export;
 *   - a response or error that settles after its setup changed is discarded;
 *   - persistent RCBD and governed exports still target the correct run and
 *     echo the backend's export token unchanged.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";

vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn(),
  recordAnalysisFailure: vi.fn(),
}));

vi.mock("@/services/persistenceRcbdApi", () => ({
  runPersistentRcbdAnalysis: vi.fn(),
  downloadPersistentRcbdReport: vi.fn(),
}));

vi.mock("@/lib/geneticsUploadApi", () => ({
  downloadReport: vi.fn(),
}));

vi.mock("@/services/geneticsUploadApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/geneticsUploadApi")>();
  return { ...actual, analyzeUpload: vi.fn() };
});

import { AnovaModulePanel } from "../AnovaModulePanel";
import { analyzeUpload } from "@/services/geneticsUploadApi";
import { downloadReport } from "@/lib/geneticsUploadApi";
import {
  downloadPersistentRcbdReport,
  runPersistentRcbdAnalysis,
} from "@/services/persistenceRcbdApi";
import { recordAnalysis } from "@/services/history/historyService";
import { anovaReportFilename, anovaRunSetupKey, buildAnovaRunSetup } from "../anovaRunIdentity";

const runPersistent = vi.mocked(runPersistentRcbdAnalysis);
const runGoverned = vi.mocked(analyzeUpload);
const persistentDownload = vi.mocked(downloadPersistentRcbdReport);
const governedDownload = vi.mocked(downloadReport);

function makeDataset(name = "Test_RCBD.csv", token = "dataset-token-1"): DatasetContext {
  return {
    file: new File(["x"], name, { type: "text/csv" }),
    base64Content: "eA==",
    fileType: "csv",
    genotypeColumn: "genotype",
    repColumn: "rep",
    environmentColumn: null,
    availableTraitColumns: ["yield", "height"],
    mode: "single",
    datasetToken: token,
    columns: ["genotype", "rep", "yield", "height"],
    availableColumns: ["genotype", "rep", "yield", "height"],
    nRows: 4,
    dataPreview: [
      { genotype: "G1", rep: "B1", yield: 1, height: 2 },
      { genotype: "G2", rep: "B1", yield: 2, height: 3 },
      { genotype: "G1", rep: "B2", yield: 1.5, height: 2.5 },
      { genotype: "G2", rep: "B2", yield: 2.5, height: 3.5 },
    ],
  } as DatasetContext;
}

function makeResponse(tag: string, extra: Partial<UploadAnalysisResponse> = {}): UploadAnalysisResponse {
  return {
    summary_table: [],
    failed_traits: [],
    dataset_summary: { n_genotypes: 2, n_reps: 2, n_environments: 1, mode: "single" } as never,
    trait_results: {
      yield: {
        status: "success",
        data_warnings: [],
        analysis_result: {
          interpretation: `interpretation-${tag}`,
          result: {
            anova_table: {
              source: ["genotype", "Residuals"],
              df: [1, 2],
              ss: [1, 0.5],
              ms: [1, 0.25],
              f_value: [4, null],
              p_value: [0.18, null],
            },
          },
        },
      },
    } as never,
    ...extra,
  };
}

const persistence = {
  study_id: "study-1",
  dataset_id: "dataset-1",
  dataset_version_id: "dv-1",
  analysis_run_id: "run-rcbd-1",
  prepare_outcome: "CREATED",
  run_outcome: "CREATED",
  run_status: "COMPLETED",
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Radix Tabs activate on mousedown, not click. */
function chooseDesign(label: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name: label }), { button: 0, ctrlKey: false });
}

function runButton() {
  return screen.getByRole("button", { name: /Run Analysis/i });
}

function selectYield() {
  fireEvent.click(screen.getByRole("checkbox", { name: "yield" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  governedDownload.mockResolvedValue(new Blob(["docx"]));
  persistentDownload.mockResolvedValue(undefined);
  // jsdom has no object URLs.
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:test";
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
});

describe("ANOVA result identity — RCBD → CRD after completion (audit reproduction)", () => {
  it("clears the RCBD result and its export when the design is switched to CRD", async () => {
    runPersistent.mockResolvedValue(makeResponse("rcbd", { persistence }));
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());

    expect(await screen.findByText(/ANOVA Results — Randomized Complete Block Design \(RCBD\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Persistent ANOVA Report/i })).toBeEnabled();

    chooseDesign("CRD");

    await waitFor(() => {
      expect(screen.queryByTestId("anova-run-result")).not.toBeInTheDocument();
    });
    // Never an RCBD result under a CRD heading, and no report button for it.
    expect(screen.queryByText(/ANOVA Results — Completely Randomized Design/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download .*ANOVA Report/i })).not.toBeInTheDocument();
  });

  it("does not restore the cleared result when the user switches back to RCBD", async () => {
    runPersistent.mockResolvedValue(makeResponse("rcbd", { persistence }));
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());
    await screen.findByTestId("anova-run-result");

    chooseDesign("CRD");
    chooseDesign("RCBD");

    await waitFor(() => expect(screen.queryByTestId("anova-run-result")).not.toBeInTheDocument());
  });

  it.each([
    ["inferential alpha", () => fireEvent.click(screen.getByRole("button", { name: "α = 0.10" }))],
    ["response variables", () => fireEvent.click(screen.getByRole("checkbox", { name: "height" }))],
  ])("clears the result when %s changes", async (_label, change) => {
    runPersistent.mockResolvedValue(makeResponse("rcbd", { persistence }));
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());
    await screen.findByTestId("anova-run-result");

    change();

    await waitFor(() => expect(screen.queryByTestId("anova-run-result")).not.toBeInTheDocument());
  });

  it("clears the result when the dataset is replaced", async () => {
    runPersistent.mockResolvedValue(makeResponse("rcbd", { persistence }));
    const { rerender } = render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());
    await screen.findByTestId("anova-run-result");

    rerender(<AnovaModulePanel datasetContext={makeDataset("Other.csv", "dataset-token-2")} />);

    await waitFor(() => expect(screen.queryByTestId("anova-run-result")).not.toBeInTheDocument());
  });
});

describe("ANOVA result identity — changes while a request is pending", () => {
  it("discards a late RCBD response after the design changed to CRD", async () => {
    const pending = deferred<UploadAnalysisResponse>();
    runPersistent.mockReturnValue(pending.promise);
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());
    expect(runPersistent).toHaveBeenCalledTimes(1);

    chooseDesign("CRD");
    await act(async () => {
      pending.resolve(makeResponse("late-rcbd", { persistence }));
      await pending.promise;
    });

    expect(screen.queryByTestId("anova-run-result")).not.toBeInTheDocument();
    expect(screen.queryByText(/ANOVA Results/)).not.toBeInTheDocument();
    // The run did execute server-side, so history still records it truthfully.
    expect(vi.mocked(recordAnalysis)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordAnalysis).mock.calls[0][0]).toMatchObject({ designType: "rcbd" });
    // The user can run the new setup immediately.
    expect(runButton()).toBeEnabled();
  });

  it("discards a late error after alpha changed", async () => {
    const pending = deferred<UploadAnalysisResponse>();
    runPersistent.mockReturnValue(pending.promise);
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());

    fireEvent.click(screen.getByRole("button", { name: "α = 0.01" }));
    await act(async () => {
      pending.reject(new Error("backend exploded for the old setup"));
      await pending.promise.catch(() => undefined);
    });

    expect(screen.queryByText(/backend exploded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Analysis failed/)).not.toBeInTheDocument();
  });

  it("only the newest run populates the result when an older one settles last", async () => {
    const first = deferred<UploadAnalysisResponse>();
    runPersistent.mockReturnValueOnce(first.promise);
    runGoverned.mockResolvedValueOnce(makeResponse("crd", { export_token: "tok-crd" }));
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton()); // RCBD, pending

    chooseDesign("CRD");
    fireEvent.click(runButton()); // CRD, resolves
    expect(await screen.findByText(/ANOVA Results — Completely Randomized Design \(CRD\)/)).toBeInTheDocument();

    await act(async () => {
      first.resolve(makeResponse("rcbd", { persistence }));
      await first.promise;
    });
    expect(screen.getByTestId("anova-run-result")).toHaveAttribute("data-run-design", "crd");
    expect(screen.queryByText(/Randomized Complete Block Design \(RCBD\)/)).not.toBeInTheDocument();
  });
});

describe("ANOVA result identity — exports use the completed run", () => {
  it("persistent RCBD export targets the run id with an rcbd filename", async () => {
    runPersistent.mockResolvedValue(makeResponse("rcbd", { persistence }));
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    selectYield();
    fireEvent.click(runButton());
    fireEvent.click(await screen.findByRole("button", { name: /Download Persistent ANOVA Report/i }));

    await waitFor(() => expect(persistentDownload).toHaveBeenCalledTimes(1));
    const [runId, filename] = persistentDownload.mock.calls[0];
    expect(runId).toBe("run-rcbd-1");
    expect(filename).toMatch(/^VivaSense_ANOVA_rcbd_\d{4}-\d{2}-\d{2}\.docx$/);
    expect(governedDownload).not.toHaveBeenCalled();
  });

  it("governed CRD export echoes the exact export token and uses a crd filename", async () => {
    runGoverned.mockResolvedValue(makeResponse("crd", { export_token: "exact-token-xyz" }));
    const clicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = () => clicks.push((el as HTMLAnchorElement).download);
      }
      return el;
    });
    render(<AnovaModulePanel datasetContext={makeDataset()} />);
    chooseDesign("CRD");
    selectYield();
    fireEvent.click(runButton());
    fireEvent.click(await screen.findByRole("button", { name: /^Download ANOVA Report$/i }));

    await waitFor(() => expect(governedDownload).toHaveBeenCalledTimes(1));
    const [module, payload] = governedDownload.mock.calls[0];
    expect(module).toBe("anova");
    expect((payload as Record<string, unknown>).export_token).toBe("exact-token-xyz");
    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(clicks[0]).toMatch(/^VivaSense_ANOVA_crd_\d{4}-\d{2}-\d{2}\.docx$/);
    expect(persistentDownload).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("anovaRunIdentity helpers", () => {
  const ctx = makeDataset();
  const base = { alpha: 0.05 as const, traits: ["yield", "height"], datasetContext: ctx };

  it("ignores roles the design does not use and the order of response variables", () => {
    const a = buildAnovaRunSetup({ ...base, design: "crd", mapping: { treatment: "genotype", rep: "rep" } });
    const b = buildAnovaRunSetup({
      ...base,
      traits: ["height", "yield"],
      design: "crd",
      mapping: { treatment: "genotype", rep: "something-else" },
    });
    expect(anovaRunSetupKey(a)).toBe(anovaRunSetupKey(b));
  });

  it("distinguishes design, alpha, used mappings and dataset", () => {
    const key = (over: Partial<Parameters<typeof buildAnovaRunSetup>[0]>) =>
      anovaRunSetupKey(
        buildAnovaRunSetup({ ...base, design: "rcbd", mapping: { treatment: "genotype", rep: "rep" }, ...over }),
      );
    const original = key({});
    expect(key({ design: "crd" })).not.toBe(original);
    expect(key({ alpha: 0.1 })).not.toBe(original);
    expect(key({ mapping: { treatment: "genotype", rep: "block" } })).not.toBe(original);
    expect(key({ datasetContext: makeDataset("Test_RCBD.csv", "other-token") })).not.toBe(original);
  });

  it("names the report after the run's design", () => {
    const date = new Date("2026-11-20T12:00:00Z");
    expect(anovaReportFilename({ design: "rcbd" }, date)).toBe("VivaSense_ANOVA_rcbd_2026-11-20.docx");
    expect(anovaReportFilename({ design: "split_plot_rcbd" }, date)).toBe(
      "VivaSense_ANOVA_split_plot_rcbd_2026-11-20.docx",
    );
  });
});
