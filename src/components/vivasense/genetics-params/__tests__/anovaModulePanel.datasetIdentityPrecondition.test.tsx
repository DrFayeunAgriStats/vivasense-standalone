/**
 * W1-INT-09 — corrected W1-UI-04 regression: the precondition for role
 * confirmation is a valid `datasetInstanceId`, NOT a non-null
 * `datasetToken`. An earlier audit pass mistakenly treated "datasetToken is
 * null" itself as the defect; the actual defect was that NOTHING validated
 * dataset identity at all. `datasetToken` absence is a normal, legitimate
 * backend operational fallback (see multitrait_upload_routes.py) and must
 * never block confirmation on its own — only a missing/malformed
 * `datasetInstanceId` may.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { DatasetContext } from "@/types/geneticsUpload";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/geneticsUploadApi", () => ({ downloadReport: vi.fn().mockResolvedValue(new Blob()) }));
vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn().mockResolvedValue(undefined),
  recordAnalysisFailure: vi.fn().mockResolvedValue(undefined),
}));
const analyzeUploadMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/geneticsUploadApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/geneticsUploadApi")>();
  return { ...actual, analyzeUpload: analyzeUploadMock };
});
import { AnovaModulePanel } from "../AnovaModulePanel";

afterEach(() => { cleanup(); analyzeUploadMock.mockReset(); });

function buildDataset(over: Partial<DatasetContext> = {}): DatasetContext {
  const base: any = {
    file: new File(["a"], "fixture.csv"),
    base64Content: "AAAA",
    fileType: "csv",
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    environmentColumn: null,
    availableTraitColumns: ["Yield_kg"],
    mode: "single",
    datasetInstanceId: "instance-1",
    columns: ["Genotype", "Rep"],
    dataPreview: [
      { Genotype: "G01", Rep: "R1" },
      { Genotype: "G02", Rep: "R1" },
    ],
    ...over,
  };
  return base as DatasetContext;
}

async function mapAndSelectTrait() {
  const combos = screen.getAllByRole("combobox");
  fireEvent.click(combos[0]);
  fireEvent.click(await screen.findByRole("option", { name: "Genotype" }));
  fireEvent.click(screen.getAllByRole("combobox")[1]);
  fireEvent.click(await screen.findByRole("option", { name: "Rep" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
}

const runButton = () => screen.getByRole("button", { name: /^Run Analysis$/i });
const confirmButton = () => screen.queryByRole("button", { name: /Confirm experimental roles/i });

describe("W1-INT-09 — P: operational token absence does not block confirmation", () => {
  it("datasetToken: null + valid datasetInstanceId -> confirmation succeeds, Run enables", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset({ datasetToken: null })} />);
    await mapAndSelectTrait();
    expect(confirmButton()).toBeTruthy();
    fireEvent.click(confirmButton()!);
    expect(runButton()).not.toBeDisabled();
  });

  it("datasetToken: undefined (key omitted) + valid datasetInstanceId -> confirmation succeeds, Run enables", async () => {
    const ds = buildDataset();
    delete (ds as any).datasetToken;
    render(<AnovaModulePanel datasetContext={ds} />);
    await mapAndSelectTrait();
    expect(confirmButton()).toBeTruthy();
    fireEvent.click(confirmButton()!);
    expect(runButton()).not.toBeDisabled();
  });

  it('datasetToken: "" + valid datasetInstanceId -> confirmation succeeds, Run enables', async () => {
    render(<AnovaModulePanel datasetContext={buildDataset({ datasetToken: "" })} />);
    await mapAndSelectTrait();
    expect(confirmButton()).toBeTruthy();
    fireEvent.click(confirmButton()!);
    expect(runButton()).not.toBeDisabled();
  });
});

describe("W1-INT-09 — O: malformed/missing datasetInstanceId fails closed regardless of datasetToken", () => {
  it('datasetInstanceId: "" -> confirmation cannot proceed even though the mapping is complete', async () => {
    render(<AnovaModulePanel datasetContext={buildDataset({ datasetInstanceId: "" })} />);
    await mapAndSelectTrait();
    // Fail-closed notice replaces the Confirm control entirely.
    expect(confirmButton()).toBeNull();
    expect(screen.getByText(/stable dataset identity could not be established/i)).toBeTruthy();
    expect(runButton()).toBeDisabled();
  });

  it('datasetInstanceId: "   " (whitespace only) -> confirmation cannot proceed', async () => {
    render(<AnovaModulePanel datasetContext={buildDataset({ datasetInstanceId: "   " })} />);
    await mapAndSelectTrait();
    expect(confirmButton()).toBeNull();
    expect(runButton()).toBeDisabled();
  });

  it("a previously valid confirmation cannot be exploited by a subsequent malformed-identity dataset swap", async () => {
    const { rerender } = render(<AnovaModulePanel datasetContext={buildDataset({ datasetInstanceId: "instance-good" })} />);
    await mapAndSelectTrait();
    fireEvent.click(confirmButton()!);
    expect(runButton()).not.toBeDisabled();

    rerender(<AnovaModulePanel datasetContext={buildDataset({ datasetInstanceId: "" })} />);
    expect(runButton()).toBeDisabled();
    expect(screen.getByText(/stable dataset identity could not be established/i)).toBeTruthy();
  });
});

describe("W1-INT-09 — E: dataset-instance change invalidates confirmation even with identical role names and tokens", () => {
  it("Dataset A instance -> Dataset B instance (same datasetToken, same column names) still invalidates", async () => {
    const { rerender } = render(
      <AnovaModulePanel datasetContext={buildDataset({ datasetInstanceId: "instance-A", datasetToken: "shared-token" })} />
    );
    await mapAndSelectTrait();
    fireEvent.click(confirmButton()!);
    expect(runButton()).not.toBeDisabled();

    rerender(
      <AnovaModulePanel datasetContext={buildDataset({ datasetInstanceId: "instance-B", datasetToken: "shared-token" })} />
    );
    expect(runButton()).toBeDisabled();
  });
});
