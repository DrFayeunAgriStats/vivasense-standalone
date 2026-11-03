/**
 * REL-OPEN-01 — Trait Association reports rg only (a genetic statistic):
 * A1 declaration + A1b RCBD are mandatory, deprecated request fields are gone,
 * and a not-reported rg is shown as "—", never as 0, with no significance legend.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runMock = vi.fn();
vi.mock("@/lib/advancedAnalysisApi", () => ({ runTraitAssociation: (req: unknown) => runMock(req) }));
vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn(async () => undefined),
  recordAnalysisFailure: vi.fn(async () => undefined),
}));

import { TraitAssociationPanel } from "../TraitAssociationPanel";
import { GENETIC_DECLARATION_TEXT } from "@/lib/relationshipGeneticContract";

const ctx = {
  file: new File(["x"], "trial.csv"),
  base64Content: "eA==",
  fileType: "csv",
  genotypeColumn: "Genotype",
  repColumn: "Rep",
  environmentColumn: null,
  availableTraitColumns: ["Yield", "Height", "Days"],
  mode: "single",
  datasetToken: "tok-1",
} as never;

const response = {
  trait_names: ["Yield", "Height", "Days"],
  n_observations: 10,
  correlation_matrix: {
    Yield: { Yield: 1, Height: 0.62, Days: null },
    Height: { Yield: 0.62, Height: 1, Days: -0.31 },
    Days: { Yield: null, Height: -0.31, Days: 1 },
  },
  pvalue_matrix: { Yield: {}, Height: {}, Days: {} },
  significant_pairs: [],
  risk_flags: [],
  summary: { num_traits: 3, num_significant_pairs: 0, strongest_positive_pair_label: null, strongest_negative_pair_label: null },
  interpretation: "",
  warnings: [],
};

beforeEach(() => {
  runMock.mockReset();
  runMock.mockResolvedValue(response);
});

const decl = () => screen.getByLabelText(new RegExp(GENETIC_DECLARATION_TEXT.slice(0, 40))) as HTMLInputElement;
const design = () => screen.getByLabelText(/Experimental design/) as HTMLSelectElement;
const run = () => screen.getByRole("button", { name: /Run Analysis/ });

describe("TraitAssociationPanel (rg only)", () => {
  it("cannot run until both the declaration and RCBD are explicitly set", () => {
    render(<TraitAssociationPanel datasetContext={ctx} />);
    expect(decl().checked).toBe(false);
    expect(design().value).toBe("");
    expect(run()).toBeDisabled();
    fireEvent.click(decl());
    expect(run()).toBeDisabled();
    fireEvent.change(design(), { target: { value: "rcbd" } });
    expect(run()).toBeEnabled();
    expect(screen.queryByText(/Analysis unit/i)).not.toBeInTheDocument();   // misleading selector removed
  });

  it("sends the governed genetic request without deprecated fields and shows rg as estimate only", async () => {
    render(<TraitAssociationPanel datasetContext={ctx} />);
    fireEvent.click(decl());
    fireEvent.change(design(), { target: { value: "rcbd" } });
    await act(async () => { fireEvent.click(run()); });
    await waitFor(() => expect(runMock).toHaveBeenCalledTimes(1));
    expect(runMock.mock.calls[0][0]).toEqual({
      dataset_token: "tok-1",
      trait_columns: ["Yield", "Height", "Days"],
      analysis_context: "genetic",
      genetic_material_confirmed: true,
      design: "rcbd",
      alpha: 0.05,
    });
    await waitFor(() => expect(screen.getByText(/estimate only — no p-values/)).toBeInTheDocument());
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThanOrEqual(2);       // Yield×Days and Days×Yield: not reported
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });
});
