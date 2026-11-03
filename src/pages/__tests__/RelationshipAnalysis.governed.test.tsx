/**
 * REL-OPEN-01 — governed Relationship page contract (A1 + A1b).
 *
 * General is the default context, needs no genetic controls and sends the
 * canonical design token. Breeding & Genetic requires an unchecked-by-default
 * declaration AND an explicitly selected RCBD design before it can submit.
 * Switching context discards genetic-only state. Backend 422 safeguards are
 * rendered verbatim.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const requestMock = vi.fn();
vi.mock("@/services/vivasenseApiClient", () => ({
  vivaSenseRequest: (...args: unknown[]) => requestMock(...args),
}));
vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/environmentValidation", () => ({
  resolveEnvironmentMode: vi.fn(async () => ({ mode: "single" })),
}));
vi.mock("@/components/vivasense/VivaSenseResultsDisplay", () => ({ default: () => null }));

import RelationshipAnalysis from "../RelationshipAnalysis";
import { GENETIC_DECLARATION_TEXT } from "@/lib/relationshipGeneticContract";

const CSV = "Genotype,Rep,Yield,Height\nG1,R1,1,10\nG1,R2,2,11\nG2,R1,3,15\nG2,R2,4,14\nG3,R1,5,20\nG3,R2,6,21\n";

async function renderWithData() {
  render(
    <MemoryRouter>
      <RelationshipAnalysis />
    </MemoryRouter>,
  );
  const input = screen.getByLabelText("Upload relationship dataset") as HTMLInputElement;
  const file = new File([CSV], "trial.csv", { type: "text/csv" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  await waitFor(() => expect(screen.getByLabelText("Variable Yield")).toBeInTheDocument());
}

const runButton = () =>
  screen.getByRole("button", { name: /Run (General Correlation|Breeding & Genetic Relationships)/ });

function pickTraits() {
  fireEvent.click(screen.getByLabelText("Variable Yield"));
  fireEvent.click(screen.getByLabelText("Variable Height"));
}

function goGenetic() {
  fireEvent.click(screen.getByRole("button", { name: /Breeding & Genetic Relationships/ }));
}

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({ trait_names: ["Yield", "Height"], warnings: [], phenotypic: { r_matrix: [], n_observations: 6 } });
});

describe("General context (default)", () => {
  it("shows no genetic controls and sends general + canonical design + method + alpha + variables", async () => {
    await renderWithData();
    expect(screen.queryByTestId("genetic-declaration-controls")).not.toBeInTheDocument();
    pickTraits();
    fireEvent.change(screen.getByLabelText("Significance level"), { target: { value: "0.1" } });
    expect(runButton()).toBeEnabled();
    await act(async () => { fireEvent.click(runButton()); });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));
    const [path, opts] = requestMock.mock.calls[0];
    expect(path).toBe("/genetics/correlation");
    expect(opts.jsonBody).toMatchObject({
      analysis_context: "general",
      genetic_material_confirmed: false,
      design: "not_required",
      alpha: 0.1,
      method: "pearson",
      trait_columns: ["Yield", "Height"],
      genotype_column: null,
      rep_column: null,
    });
  });
});

describe("Breeding & Genetic context", () => {
  async function geneticWithStructure() {
    await renderWithData();
    goGenetic();
    fireEvent.change(screen.getByLabelText("Genotype / entry column"), { target: { value: "Genotype" } });
    fireEvent.change(screen.getByLabelText("Replication / Block column"), { target: { value: "Rep" } });
    pickTraits();
  }

  it("shows both controls unset by default and cannot submit without A1 and A1b", async () => {
    await geneticWithStructure();
    const decl = screen.getByLabelText(new RegExp(GENETIC_DECLARATION_TEXT.slice(0, 40))) as HTMLInputElement;
    const design = screen.getByLabelText(/Experimental design/) as HTMLSelectElement;
    expect(decl.checked).toBe(false);
    expect(design.value).toBe("");
    expect(runButton()).toBeDisabled();                        // neither

    fireEvent.click(decl);
    expect(runButton()).toBeDisabled();                        // A1 only

    fireEvent.click(decl);
    fireEvent.change(design, { target: { value: "rcbd" } });
    expect(runButton()).toBeDisabled();                        // A1b only
  });

  it("offers CRD and multi-environment only as unavailable options", async () => {
    await geneticWithStructure();
    const design = screen.getByLabelText(/Experimental design/) as HTMLSelectElement;
    const opts = Array.from(design.options).map((o) => [o.value, o.disabled] as const);
    expect(opts).toEqual([["", false], ["rcbd", false], ["crd", true], ["met", true]]);
  });

  it("sends genetic + confirmed + rcbd only after both deliberate actions", async () => {
    await geneticWithStructure();
    fireEvent.click(screen.getByLabelText(new RegExp(GENETIC_DECLARATION_TEXT.slice(0, 40))));
    fireEvent.change(screen.getByLabelText(/Experimental design/), { target: { value: "rcbd" } });
    expect(runButton()).toBeEnabled();
    await act(async () => { fireEvent.click(runButton()); });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));
    expect(requestMock.mock.calls[0][1].jsonBody).toMatchObject({
      analysis_context: "genetic",
      genetic_material_confirmed: true,
      design: "rcbd",
      alpha: 0.05,
      genotype_column: "Genotype",
      rep_column: "Rep",
    });
  });

  it("switching to General and back never carries the declaration or design forward", async () => {
    await geneticWithStructure();
    fireEvent.click(screen.getByLabelText(new RegExp(GENETIC_DECLARATION_TEXT.slice(0, 40))));
    fireEvent.change(screen.getByLabelText(/Experimental design/), { target: { value: "rcbd" } });

    fireEvent.click(screen.getByRole("button", { name: /General Correlation/ }));
    expect(screen.queryByTestId("genetic-declaration-controls")).not.toBeInTheDocument();

    goGenetic();
    expect((screen.getByLabelText(new RegExp(GENETIC_DECLARATION_TEXT.slice(0, 40))) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Experimental design/) as HTMLSelectElement).value).toBe("");
  });

  it("renders a backend scientific safeguard (422) verbatim", async () => {
    const detail =
      "Genetic correlation requires an explicitly declared supported experimental design (design='rcbd'). VivaSense will not infer RCBD from the dataset structure.";
    requestMock.mockRejectedValueOnce(new Error(detail));
    await geneticWithStructure();
    fireEvent.click(screen.getByLabelText(new RegExp(GENETIC_DECLARATION_TEXT.slice(0, 40))));
    fireEvent.change(screen.getByLabelText(/Experimental design/), { target: { value: "rcbd" } });
    await act(async () => { fireEvent.click(runButton()); });
    await waitFor(() => expect(screen.getByTestId("relationship-error-detail")).toHaveTextContent(detail));
    expect(screen.getByText("The analysis was not run")).toBeInTheDocument();
  });
});
