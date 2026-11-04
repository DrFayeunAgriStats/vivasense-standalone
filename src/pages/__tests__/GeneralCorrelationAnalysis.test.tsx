/**
 * REL-UI-01 Phase A (Option B) — General-only page (mocked backend).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const requestMock = vi.fn();
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: (...a: unknown[]) => requestMock(...a) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import GeneralCorrelationAnalysis from "../GeneralCorrelationAnalysis";

const CSV = "Genotype,Rep,Yield,Height,Days\nG1,R1,1,10,5\nG1,R2,2,11,6\nG2,R1,3,15,5\nG2,R2,4,14,7\nG3,R1,5,20,6\nG3,R2,6,21,8\n";
const RESULT = {
  analysis_context: "general", method: "pearson", alpha: 0.05, trait_names: ["Yield", "Height"],
  pair_results: [{ trait_1: "Yield", trait_2: "Height", n: 6, estimable: true, r: 0.9871, p_raw: 0.00026, p_adjusted: 0.00026, significant_adjusted: true }],
  multiplicity: { n_hypotheses: 1, n_pairs_not_estimable: 0 }, phenotypic: { n_observations: 6 },
  warnings: ["engine warning"], interpretation: "Correlation describes statistical association only and does not establish causation.",
  result_integrity: { scheme: "relationship-seal-v1", key_id: "sha256:x", mac: "m" },
};

async function upload() {
  render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Upload general correlation dataset"), {
      target: { files: [new File([CSV], "trial.csv", { type: "text/csv" })] },
    });
  });
  await waitFor(() => expect(screen.getByLabelText("Variable Yield")).toBeInTheDocument());
}
const run = () => screen.getByRole("button", { name: /Run General Correlation/ });

beforeEach(() => {
  requestMock.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:x") as never;
  URL.revokeObjectURL = vi.fn() as never;
});

describe("General correlation page", () => {
  it("has no genetic, genotype, replication or design control", async () => {
    await upload();
    for (const label of [/Genotype \/ entry column/, /Replication/, /Experimental design/, /genetic materials/i, /Breeding & Genetic/]) {
      expect(screen.queryByLabelText(label)).toBeNull();
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("offers every numeric column as a variable (no structural roles are assumed)", async () => {
    await upload();
    for (const v of ["Yield", "Height", "Days"]) expect(screen.getByLabelText(`Variable ${v}`)).toBeInTheDocument();
    expect(screen.queryByLabelText("Variable Genotype")).toBeNull();   // non-numeric
  });

  it("cannot run with fewer than two variables", async () => {
    await upload();
    expect(run()).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Variable Yield"));
    expect(run()).toBeDisabled();
  });

  it("sends the exact General contract and renders r, n, raw p, adjusted p, decision and α", async () => {
    requestMock.mockResolvedValueOnce(RESULT);
    await upload();
    fireEvent.click(screen.getByLabelText("Variable Yield"));
    fireEvent.click(screen.getByLabelText("Variable Height"));
    fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
    fireEvent.change(screen.getByLabelText("Significance level"), { target: { value: "0.1" } });
    await act(async () => { fireEvent.click(run()); });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));
    const [path, opts] = requestMock.mock.calls[0];
    expect(path).toBe("/genetics/correlation/general");
    expect(Object.keys(opts.jsonBody).sort()).toEqual(["alpha", "base64_content", "file_type", "method", "trait_columns"]);
    expect(opts.jsonBody).toMatchObject({ file_type: "csv", trait_columns: ["Yield", "Height"], method: "spearman", alpha: 0.1 });
    const table = await screen.findByTestId("general-pair-table");
    for (const cell of ["0.987", "6", "<0.001", "yes"]) expect(table).toHaveTextContent(cell);
    expect(screen.getByTestId("general-inference-basis")).toHaveTextContent("α = 0.05");
    expect(screen.getByText("engine warning")).toBeInTheDocument();
    expect(screen.getByTestId("general-interpretation")).toHaveTextContent("does not establish causation");
  });

  it("downloads the Word report by sending the sealed result unchanged to the General export", async () => {
    requestMock.mockResolvedValueOnce(RESULT);
    await upload();
    fireEvent.click(screen.getByLabelText("Variable Yield")); fireEvent.click(screen.getByLabelText("Variable Height"));
    await act(async () => { fireEvent.click(run()); });
    requestMock.mockResolvedValueOnce(new Blob(["docx"]));
    const dl = await screen.findByTestId("general-word-download");
    await act(async () => { fireEvent.click(dl); });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    const [path, opts] = requestMock.mock.calls[1];
    expect(path).toBe("/export/correlation-word/general");
    expect(opts).toMatchObject({ method: "POST", responseType: "blob", jsonBody: RESULT });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("disables the download without a seal and shows a backend refusal verbatim", async () => {
    const { result_integrity: _s, ...unsealed } = RESULT;
    requestMock.mockResolvedValueOnce(unsealed);
    await upload();
    fireEvent.click(screen.getByLabelText("Variable Yield")); fireEvent.click(screen.getByLabelText("Variable Height"));
    await act(async () => { fireEvent.click(run()); });
    expect(await screen.findByTestId("general-word-download")).toBeDisabled();
    expect(screen.getByTestId("general-word-unavailable")).toBeInTheDocument();
  });

  it("shows a backend refusal of the export verbatim and saves nothing", async () => {
    requestMock.mockResolvedValueOnce(RESULT);
    await upload();
    fireEvent.click(screen.getByLabelText("Variable Yield")); fireEvent.click(screen.getByLabelText("Variable Height"));
    await act(async () => { fireEvent.click(run()); });
    const msg = "General Word report refused: the statistical values in this payload do not match (integrity seal mismatch).";
    requestMock.mockRejectedValueOnce(new Error(msg));
    const dl = await screen.findByTestId("general-word-download");
    await act(async () => { fireEvent.click(dl); });
    await waitFor(() => expect(screen.getByTestId("general-word-error")).toHaveTextContent(msg));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("shows an analysis refusal (e.g. 503 signing key / 422) under 'The analysis was not run'", async () => {
    requestMock.mockRejectedValueOnce(new Error("General correlation is unavailable: the result signing key is not configured on this server"));
    await upload();
    fireEvent.click(screen.getByLabelText("Variable Yield")); fireEvent.click(screen.getByLabelText("Variable Height"));
    await act(async () => { fireEvent.click(run()); });
    await waitFor(() => expect(screen.getByTestId("general-error-detail")).toHaveTextContent("signing key is not configured"));
  });
});
