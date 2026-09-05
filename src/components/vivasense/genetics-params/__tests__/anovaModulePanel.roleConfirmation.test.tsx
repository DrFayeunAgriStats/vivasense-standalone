/**
 * W1-UI-04 — experimental role confirmation gate.
 *
 * "I selected these columns" is not "VivaSense may now use these columns as
 * the experimental roles in an inferential model". These tests prove Run
 * Analysis stays blocked until the researcher takes an explicit confirmation
 * action on the exact current mapping, and that the confirmation is
 * invalidated by any change to dataset identity, design, or an active
 * structural-role column — but NOT by alpha, response-trait selection, or
 * response-semantic declaration, which affect W1-INT-06's analysis-result
 * identity but not the experimental structure itself.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

import { AnovaModulePanel } from "../AnovaModulePanel";

afterEach(() => {
  cleanup();
  analyzeUploadMock.mockReset();
});

function buildDataset(over: Partial<DatasetContext> = {}): DatasetContext {
  return {
    file: new File(["a"], "fixture.csv"),
    base64Content: "AAAA",
    fileType: "csv",
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    environmentColumn: null,
    availableTraitColumns: ["Yield_kg", "Height_cm"],
    mode: "single",
    datasetToken: "ds-1",
    columns: ["Genotype", "Rep", "Variety", "Nitrogen", "Block", "Irrigation"],
    dataPreview: [
      { Genotype: "G01", Rep: "R1" },
      { Genotype: "G01", Rep: "R2" },
      { Genotype: "G02", Rep: "R1" },
      { Genotype: "G02", Rep: "R2" },
    ],
    ...over,
  };
}

function buildResponse(): UploadAnalysisResponse {
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
            anova_table: { source: ["rep", "genotype", "Residuals"], df: [2, 17, 34] },
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

function selectOption(comboIndex: number, optionName: string) {
  const combos = screen.getAllByRole("combobox");
  fireEvent.click(combos[comboIndex]);
  return screen.findByRole("option", { name: optionName }).then((opt) => fireEvent.click(opt));
}

const confirmButton = () => screen.getByRole("button", { name: /Confirm experimental roles/i });
const runButton = () => screen.getByRole("button", { name: /Run Analysis/i });

describe("W1-UI-04 — Run gate requires explicit confirmation (CRD)", () => {
  it("1 — complete CRD mapping with no confirmation leaves Run blocked", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "CRD" })[0]);
    await selectOption(0, "Genotype");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));

    expect(runButton()).toBeDisabled();
  });

  it("2 — explicit confirmation enables Run", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "CRD" })[0]);
    await selectOption(0, "Genotype");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));

    fireEvent.click(confirmButton());
    expect(runButton()).not.toBeDisabled();
  });

  it("M/13 — a programmatic selector population alone (no confirm click) is never mistaken for confirmation", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "CRD" })[0]);
    await selectOption(0, "Genotype");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Height_cm/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Height_cm/i })); // toggled back off

    // Mapping/traits were populated repeatedly but Confirm was never clicked.
    expect(runButton()).toBeDisabled();
  });
});

describe("W1-UI-04 — confirmation survives non-structural changes (RCBD)", () => {
  async function mapConfirmedRcbd() {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await selectOption(0, "Genotype");
    await selectOption(1, "Rep");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
    fireEvent.click(confirmButton());
    expect(runButton()).not.toBeDisabled();
  }

  it("3 — alpha change leaves confirmation valid", async () => {
    await mapConfirmedRcbd();
    fireEvent.click(screen.getByRole("button", { name: /α = 0\.01/ }));
    expect(runButton()).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /Confirm experimental roles/i })).toBeNull();
  });

  it("4 — response semantic declaration change leaves confirmation valid", async () => {
    await mapConfirmedRcbd();
    const scaleSelect = screen.getByRole("combobox", { name: /Response scale for Yield_kg/i });
    fireEvent.click(scaleSelect);
    fireEvent.click(await screen.findByRole("option", { name: /Percentage/i }));
    expect(runButton()).not.toBeDisabled();
  });

  it("5 — response trait selection change leaves confirmation valid", async () => {
    await mapConfirmedRcbd();
    fireEvent.click(screen.getByRole("checkbox", { name: /Height_cm/i }));
    expect(runButton()).not.toBeDisabled();
  });

  it("6 — treatment change invalidates confirmation and blocks Run", async () => {
    await mapConfirmedRcbd();
    await selectOption(0, "Rep"); // repoint Treatment/Factor selector away from Genotype
    // Now Treatment=Rep and Replication=Rep collide (W1-INT-02); pick a
    // distinct column instead so invalidation is isolated to the role change.
    // (buildDataset provides "Variety" as an unused column.)
    await selectOption(0, "Variety");
    expect(runButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: /Confirm experimental roles/i })).toBeTruthy();
  });

  it("7 — block/rep change invalidates confirmation and blocks Run", async () => {
    await mapConfirmedRcbd();
    await selectOption(1, "Block");
    expect(runButton()).toBeDisabled();
  });

  it("8 — design change invalidates confirmation and blocks Run", async () => {
    await mapConfirmedRcbd();
    await userEvent.click(screen.getAllByRole("tab", { name: "CRD" })[0]);
    expect(runButton()).toBeDisabled();
  });

  it("9 — dataset replacement invalidates confirmation and blocks Run", async () => {
    const { rerender } = render(<AnovaModulePanel datasetContext={buildDataset({ datasetToken: "ds-A" })} />);
    await selectOption(0, "Genotype");
    await selectOption(1, "Rep");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
    fireEvent.click(confirmButton());
    expect(runButton()).not.toBeDisabled();

    rerender(<AnovaModulePanel datasetContext={buildDataset({ datasetToken: "ds-B", file: new File(["b"], "other.csv") })} />);
    expect(runButton()).toBeDisabled();
  });
});

describe("W1-UI-04 — design coverage", () => {
  it("10 — Factorial CRD confirmation covers Factor A + Factor B", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "Factorial CRD" })[0]);
    await selectOption(0, "Variety");
    await selectOption(1, "Nitrogen");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
    expect(runButton()).toBeDisabled();

    fireEvent.click(confirmButton());
    expect(runButton()).not.toBeDisabled();

    // Changing Factor B must invalidate.
    await selectOption(1, "Block");
    expect(runButton()).toBeDisabled();
  });

  it("11 — Factorial RCBD confirmation covers Factor A + Factor B + block", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "Factorial RCBD" })[0]);
    await selectOption(0, "Variety");
    await selectOption(1, "Nitrogen");
    await selectOption(2, "Rep");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
    fireEvent.click(confirmButton());
    expect(runButton()).not.toBeDisabled();

    await selectOption(2, "Block");
    expect(runButton()).toBeDisabled();
  });

  it("12 — Split-Plot RCBD confirmation covers block + whole-plot + subplot", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "Split-Plot RCBD" })[0]);
    await selectOption(0, "Rep");
    await selectOption(1, "Irrigation");
    await selectOption(2, "Variety");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
    fireEvent.click(confirmButton());
    expect(runButton()).not.toBeDisabled();

    await selectOption(1, "Nitrogen");
    expect(runButton()).toBeDisabled();
  });
});

describe("W1-UI-04 — researcher-facing role summary", () => {
  it("presents the exact scientific mapping before confirmation, including split-plot hierarchy wording", async () => {
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await userEvent.click(screen.getAllByRole("tab", { name: "Split-Plot RCBD" })[0]);
    await selectOption(0, "Rep");
    await selectOption(1, "Irrigation");
    await selectOption(2, "Variety");
    fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));

    expect(screen.getByText(/Whole plots are organized within blocks; subplots are organized within whole plots\./i)).toBeTruthy();
  });
});
