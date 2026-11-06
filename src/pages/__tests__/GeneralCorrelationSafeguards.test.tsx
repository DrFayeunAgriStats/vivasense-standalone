/**
 * REL-UI-01 scientific safeguards on the General Correlation page
 * (presentation only; mocked backend).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const requestMock = vi.fn();
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: (...a: unknown[]) => requestMock(...a) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import GeneralCorrelationAnalysis from "../GeneralCorrelationAnalysis";
import {
  MULTIPLE_TESTING_NOTE, PAIRWISE_MISSING_NOTE, SCOPE_CAUTION, SPEARMAN_APPROXIMATION_NOTE,
} from "@/lib/generalCorrelationCautions";

const CSV = "Yield,Height\n1,10\n2,11\n3,15\n4,14\n5,20\n6,21\n";
const result = (method: "pearson" | "spearman") => ({
  analysis_context: "general", method, alpha: 0.05, trait_names: ["Yield", "Height"],
  pair_results: [{ trait_1: "Yield", trait_2: "Height", n: 6, estimable: true, r: 0.97, p_raw: 0.0013, p_adjusted: 0.0013, significant_adjusted: true }],
  multiplicity: { n_hypotheses: 1 }, phenotypic: { n_observations: 6 }, warnings: [], interpretation: "x",
  result_integrity: { scheme: "relationship-seal-v1", key_id: "sha256:x", mac: "m" },
});

async function upload() {
  render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Upload general correlation dataset"), { target: { files: [new File([CSV], "t.csv")] } });
  });
  await waitFor(() => expect(screen.getByLabelText("Variable Yield")).toBeInTheDocument());
}

async function run(method: "pearson" | "spearman") {
  requestMock.mockResolvedValueOnce(result(method));
  await upload();
  if (method === "spearman") fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
  fireEvent.click(screen.getByLabelText("Variable Yield")); fireEvent.click(screen.getByLabelText("Variable Height"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Run General Correlation/ })); });
  await screen.findByTestId("general-results-notes");
}

beforeEach(() => requestMock.mockReset());

describe("General Correlation safeguards", () => {
  it("shows the scope/independence caution before any data is uploaded or analysed", () => {
    render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
    const note = screen.getByTestId("general-scope-caution");
    expect(note).toHaveTextContent(SCOPE_CAUTION);
    expect(screen.getByRole("note", { name: "Scope of this analysis" })).toBe(note);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("states the required points in qualified wording", () => {
    for (const must of ["ordinary associations", "does not model the experimental design", "blocks", "genotypes",
      "clustering", "repeated measurements", "may be unreliable", "not genetic correlations", "not adjusted for the experimental design"]) {
      expect(SCOPE_CAUTION).toContain(must);
    }
    expect(SCOPE_CAUTION).not.toMatch(/anti-conservative|always/);
    expect(MULTIPLE_TESTING_NOTE).toContain("declared exploratory default");
    expect(MULTIPLE_TESTING_NOTE).toContain("does not by itself establish biological or agronomic importance");
    expect(PAIRWISE_MISSING_NOTE).toContain("does not guarantee unbiased estimates");
  });

  it("shows the Spearman approximation note only when Spearman is selected (before running)", async () => {
    await upload();
    expect(screen.queryByTestId("general-spearman-caution")).toBeNull();
    fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
    expect(screen.getByTestId("general-spearman-caution")).toHaveTextContent(SPEARMAN_APPROXIMATION_NOTE);
    fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "pearson" } });
    expect(screen.queryByTestId("general-spearman-caution")).toBeNull();
  });

  it("shows scope, multiple-testing and missing-data notes with Pearson results (no Spearman note)", async () => {
    await run("pearson");
    expect(screen.getByTestId("general-results-scope")).toHaveTextContent(SCOPE_CAUTION);
    expect(screen.getByTestId("general-results-multiplicity")).toHaveTextContent(MULTIPLE_TESTING_NOTE);
    expect(screen.getByTestId("general-results-pairwise")).toHaveTextContent(PAIRWISE_MISSING_NOTE);
    expect(screen.queryByTestId("general-results-spearman")).toBeNull();
    expect(screen.getByTestId("general-scope-caution")).toBeInTheDocument();     // still visible
  });

  it("adds the Spearman approximation note to Spearman results", async () => {
    await run("spearman");
    expect(screen.getByTestId("general-results-spearman")).toHaveTextContent(SPEARMAN_APPROXIMATION_NOTE);
  });

  it("still shows raw and adjusted p-values and keeps the Word download", async () => {
    await run("pearson");
    const table = screen.getByTestId("general-pair-table");
    expect(table).toHaveTextContent("raw p");
    expect(table).toHaveTextContent("FDR-adjusted p");
    expect(screen.getByTestId("general-word-download")).toBeEnabled();
  });
});
