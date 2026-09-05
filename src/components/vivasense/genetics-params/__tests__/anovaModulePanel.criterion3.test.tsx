/**
 * W1-INT-06 Criterion 3 — direct live-state bypass regression.
 *
 * Captures the panel's design state setter and invokes it directly after an
 * RCBD result installs. This deliberately bypasses changeDesign and
 * mutateScientificInput, constructing the otherwise-forbidden adversarial
 * state: bound result context = RCBD while the rendered live form = CRD.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "../anovaDesigns";

const stateSeam = vi.hoisted(() => ({
  designSetter: null as Dispatch<SetStateAction<GovernedDesignType>> | null,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (<S,>(initial: S | (() => S)) => {
      const pair = actual.useState(initial);
      if (initial === "rcbd" && stateSeam.designSetter === null) {
        stateSeam.designSetter = pair[1] as Dispatch<SetStateAction<GovernedDesignType>>;
      }
      return pair;
    }) as typeof actual.useState,
  };
});

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
  stateSeam.designSetter = null;
});

function buildDataset(): DatasetContext {
  return {
    file: new File(["a"], "fixture.csv"),
    base64Content: "AAAA",
    fileType: "csv",
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    environmentColumn: null,
    availableTraitColumns: ["Yield_kg"],
    mode: "single",
    datasetToken: "ds-criterion-3",
    columns: ["Genotype", "Rep"],
    dataPreview: [
      { Genotype: "G01", Rep: "R1" },
      { Genotype: "G01", Rep: "R2" },
      { Genotype: "G02", Rep: "R1" },
      { Genotype: "G02", Rep: "R2" },
    ],
  };
}

function buildRcbdResponse(): UploadAnalysisResponse {
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
            treatment_decision: {
              estimable: true,
              significant: true,
              p_value: 1e-7,
              alpha: 0.05,
            },
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
    export_token: "tok-criterion-3",
  } as UploadAnalysisResponse;
}

async function mapRcbdAndSelectTrait() {
  const combos = screen.getAllByRole("combobox");
  fireEvent.click(combos[0]);
  fireEvent.click(await screen.findByRole("option", { name: "Genotype" }));
  fireEvent.click(screen.getAllByRole("combobox")[1]);
  fireEvent.click(await screen.findByRole("option", { name: "Rep" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Yield_kg/i }));
}

describe("W1-INT-06 Criterion 3 — direct live-state bypass", () => {
  it("keeps an installed RCBD result scientifically identified as RCBD while live design state is forced to CRD", async () => {
    analyzeUploadMock.mockResolvedValueOnce(buildRcbdResponse());
    render(<AnovaModulePanel datasetContext={buildDataset()} />);
    await mapRcbdAndSelectTrait();

    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await waitFor(() => {
      expect(screen.getByText(/ANOVA Results — Randomized Complete Block Design \(RCBD\)/i)).toBeTruthy();
    });

    expect(stateSeam.designSetter).not.toBeNull();
    await act(async () => stateSeam.designSetter!("crd"));

    // The bypass is genuinely active: live form state now presents CRD.
    expect(screen.getByRole("tab", { name: "CRD" })).toHaveAttribute("data-state", "active");

    // The installed result remains governed exclusively by its bound RCBD context.
    expect(screen.getByText(/ANOVA Results — Randomized Complete Block Design \(RCBD\)/i)).toBeTruthy();
    expect(screen.queryByText(/ANOVA Results — Completely Randomized Design \(CRD\)/i)).toBeNull();
    expect(screen.queryByText(/CRD has no blocking term/i)).toBeNull();
    expect(screen.getByText(/Design and analysis summary/i)).toBeTruthy();
    expect(screen.getAllByText(/Genotype/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rep/).length).toBeGreaterThan(0);
  });
});
