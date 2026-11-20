/**
 * Audit finding: General Correlation result identity.
 *
 * Reproduction: select two variables, run Pearson, switch to Spearman before
 * the response arrives. Before the fix the late Pearson result rendered under
 * the Spearman selection and its Word export was enabled.
 *
 * Contract: changing the file, the selected variables, the method or alpha
 * invalidates any pending response/error; a late response never repopulates
 * an invalidated result or enables its export. Overlapping uploads cannot
 * install the columns of a file that is no longer selected.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const requestMock = vi.fn();
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: (...a: unknown[]) => requestMock(...a) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import GeneralCorrelationAnalysis from "../GeneralCorrelationAnalysis";

const CSV = "Yield,Height,Days\n1,10,5\n2,11,6\n3,15,5\n4,14,7\n5,20,6\n6,21,8\n";
const OTHER_CSV = "Mass,Width\n1,2\n2,3\n3,5\n4,4\n";

const sealed = (method: "pearson" | "spearman", r: number) => ({
  analysis_context: "general", method, alpha: 0.05, trait_names: ["Yield", "Height"],
  pair_results: [{ trait_1: "Yield", trait_2: "Height", n: 6, estimable: true, r, p_raw: 0.001, p_adjusted: 0.001, significant_adjusted: true }],
  multiplicity: { n_hypotheses: 1, n_pairs_not_estimable: 0 }, phenotypic: { n_observations: 6 },
  warnings: [], result_integrity: { scheme: "relationship-seal-v1", key_id: "sha256:x", mac: `mac-${method}` },
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderPage() {
  render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
}

async function chooseFile(file: File) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Upload general correlation dataset"), { target: { files: [file] } });
  });
}

async function uploadAndSelect() {
  renderPage();
  await chooseFile(new File([CSV], "trial.csv", { type: "text/csv" }));
  await waitFor(() => expect(screen.getByLabelText("Variable Yield")).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText("Variable Yield"));
  fireEvent.click(screen.getByLabelText("Variable Height"));
}

const run = () => screen.getByRole("button", { name: /Run General Correlation/ });

/** Start a run whose response is held until the test releases it. */
async function startPendingRun() {
  const pending = deferred<unknown>();
  requestMock.mockReturnValueOnce(pending.promise);
  await act(async () => { fireEvent.click(run()); });
  await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));
  return pending;
}

beforeEach(() => {
  requestMock.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:x") as never;
  URL.revokeObjectURL = vi.fn() as never;
});

describe("General correlation — late responses after the setup changed", () => {
  it("Pearson → Spearman before the response: the late Pearson result is discarded and its export never enabled", async () => {
    await uploadAndSelect();
    const pending = await startPendingRun();
    expect(requestMock.mock.calls[0][1].jsonBody.method).toBe("pearson");

    fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
    await act(async () => { pending.resolve(sealed("pearson", 0.9871)); await pending.promise; });

    expect(screen.queryByTestId("general-pair-table")).toBeNull();
    expect(screen.queryByTestId("general-word-download")).toBeNull();
    expect(screen.queryByText("0.987")).toBeNull();
    // The user can run the new setup straight away.
    expect(run()).toBeEnabled();
  });

  it.each([
    ["alpha", () => fireEvent.change(screen.getByLabelText("Significance level"), { target: { value: "0.01" } })],
    ["selected variables", () => fireEvent.click(screen.getByLabelText("Variable Days"))],
  ])("discards a late response after %s changed", async (_label, change) => {
    await uploadAndSelect();
    const pending = await startPendingRun();
    change();
    await act(async () => { pending.resolve(sealed("pearson", 0.9871)); await pending.promise; });
    expect(screen.queryByTestId("general-pair-table")).toBeNull();
    expect(screen.queryByTestId("general-word-download")).toBeNull();
  });

  it("discards a late error after the method changed", async () => {
    await uploadAndSelect();
    const pending = await startPendingRun();
    fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
    await act(async () => { pending.reject(new Error("old pearson failure")); await pending.promise.catch(() => undefined); });
    expect(screen.queryByText("old pearson failure")).toBeNull();
    expect(screen.queryByText("The analysis was not run")).toBeNull();
  });

  it("discards a late response after the file was removed", async () => {
    await uploadAndSelect();
    const pending = await startPendingRun();
    fireEvent.click(screen.getByRole("button", { name: "Remove dataset" }));
    await act(async () => { pending.resolve(sealed("pearson", 0.9871)); await pending.promise; });
    expect(screen.queryByTestId("general-pair-table")).toBeNull();
    expect(screen.queryByTestId("general-word-download")).toBeNull();
  });

  it("discards a late response after the file was replaced", async () => {
    await uploadAndSelect();
    const pending = await startPendingRun();
    fireEvent.click(screen.getByRole("button", { name: "Remove dataset" }));
    await chooseFile(new File([OTHER_CSV], "other.csv", { type: "text/csv" }));
    await waitFor(() => expect(screen.getByLabelText("Variable Mass")).toBeInTheDocument());
    await act(async () => { pending.resolve(sealed("pearson", 0.9871)); await pending.promise; });
    expect(screen.queryByTestId("general-pair-table")).toBeNull();
    expect(screen.queryByTestId("general-word-download")).toBeNull();
  });

  it("only the newest run is shown when an older one settles last; export sends the newest sealed result", async () => {
    await uploadAndSelect();
    const first = await startPendingRun(); // pearson
    fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
    const spearman = sealed("spearman", 0.9429);
    requestMock.mockResolvedValueOnce(spearman);
    await act(async () => { fireEvent.click(run()); });
    expect(await screen.findByTestId("general-pair-table")).toHaveTextContent("0.943");

    await act(async () => { first.resolve(sealed("pearson", 0.9871)); await first.promise; });
    expect(screen.getByTestId("general-pair-table")).toHaveTextContent("0.943");
    expect(screen.getByTestId("general-pair-table")).not.toHaveTextContent("0.987");

    requestMock.mockResolvedValueOnce(new Blob(["docx"]));
    await act(async () => { fireEvent.click(screen.getByTestId("general-word-download")); });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(3));
    const [path, opts] = requestMock.mock.calls[2];
    expect(path).toBe("/export/correlation-word/general");
    // Exactly the sealed object returned by the backend, unchanged.
    expect(opts.jsonBody).toEqual(spearman);
  });
});

describe("General correlation — overlapping uploads", () => {
  it("a slow parse of a removed file cannot overwrite the columns of the replacement file", async () => {
    renderPage();
    const slowText = deferred<string>();
    const slowFile = new File([CSV], "slow.csv", { type: "text/csv" });
    Object.defineProperty(slowFile, "text", { value: () => slowText.promise });

    await chooseFile(slowFile);
    fireEvent.click(screen.getByRole("button", { name: "Remove dataset" }));
    await chooseFile(new File([OTHER_CSV], "other.csv", { type: "text/csv" }));
    await waitFor(() => expect(screen.getByLabelText("Variable Mass")).toBeInTheDocument());

    await act(async () => { slowText.resolve(CSV); await slowText.promise; });

    expect(screen.getByText("other.csv")).toBeInTheDocument();
    expect(screen.getByLabelText("Variable Mass")).toBeInTheDocument();
    expect(screen.queryByLabelText("Variable Yield")).toBeNull();
  });

  it("a slow parse error of a removed file is not shown against the replacement", async () => {
    renderPage();
    const slowText = deferred<string>();
    const slowFile = new File([CSV], "slow.csv", { type: "text/csv" });
    Object.defineProperty(slowFile, "text", { value: () => slowText.promise });

    await chooseFile(slowFile);
    fireEvent.click(screen.getByRole("button", { name: "Remove dataset" }));
    await chooseFile(new File([OTHER_CSV], "other.csv", { type: "text/csv" }));
    await waitFor(() => expect(screen.getByLabelText("Variable Mass")).toBeInTheDocument());

    await act(async () => { slowText.reject(new Error("slow file unreadable")); await slowText.promise.catch(() => undefined); });
    expect(screen.queryByText("slow file unreadable")).toBeNull();
  });
});
