import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatasetContext } from "@/types/geneticsUpload";
import { AnovaModulePanel } from "../AnovaModulePanel";

vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn(),
  recordAnalysisFailure: vi.fn(),
}));

vi.mock("@/services/persistenceRcbdApi", () => ({
  runPersistentRcbdAnalysis: vi.fn(),
  downloadPersistentRcbdReport: vi.fn(),
}));

const dataset = (
  name: string,
  treatment: string,
  rep: string,
  trait: string,
  token: string,
): DatasetContext => ({
  file: new File(["x"], name, { type: "text/csv" }),
  base64Content: "eA==",
  fileType: "csv",
  genotypeColumn: treatment,
  repColumn: rep,
  environmentColumn: null,
  availableTraitColumns: [trait],
  mode: "single",
  datasetToken: token,
  columns: [treatment, rep, trait],
  availableColumns: [treatment, rep, trait],
  nRows: 9,
  dataPreview: [
    { [treatment]: "T1", [rep]: "B1", [trait]: 1 },
    { [treatment]: "T2", [rep]: "B1", [trait]: 2 },
  ],
});

describe("live-browser dataset-switch regression", () => {
  it("clears the selected response when a new dataset replaces the previous one", async () => {
    const first = dataset("factorial.csv", "nitrogen", "rep", "yield_t_ha", "token-1");
    const second = dataset("Test_RCBD.csv", "genotype", "rep", "fresh_leaf_yield", "token-2");

    const { rerender } = render(<AnovaModulePanel datasetContext={first} />);

    const oldResponse = await screen.findByLabelText("yield_t_ha");
    fireEvent.click(oldResponse);
    expect(oldResponse).toBeChecked();

    rerender(<AnovaModulePanel datasetContext={second} />);

    await waitFor(() => {
      expect(screen.queryByLabelText("yield_t_ha")).not.toBeInTheDocument();
    });
    const newResponse = screen.getByLabelText("fresh_leaf_yield");
    expect(newResponse).not.toBeChecked();
    expect(screen.getByText("Using:").parentElement).toHaveTextContent("Test_RCBD.csv");
  });
});
