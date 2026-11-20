/**
 * REL-UI-03: General Correlation interpretation.
 *  - on-demand pair scatterplot from exactly the coefficient's complete rows
 *  - strength label consistent with the displayed coefficient; negligible
 *    associations described neutrally (mirrors general_correlation.py)
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { buildInterpretation, strengthLabel, strengthPhrase, formatR } from "@/lib/generalCorrelationPresentation";
import { pairCompleteRows, pairScatterData, toFiniteNumber } from "@/lib/generalCorrelationPairData";
import { STRENGTH_CONVENTION_NOTE } from "@/lib/generalCorrelationCautions";

const requestMock = vi.fn();
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: (...a: unknown[]) => requestMock(...a) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("recharts", async (importOriginal) => ({ ...await importOriginal<typeof import("recharts")>(), ResponsiveContainer: () => null }));

import GeneralCorrelationAnalysis from "../GeneralCorrelationAnalysis";

describe("strength convention", () => {
  it.each([
    [0.6996, "strong"], [0.6994, "moderate"], [-0.89951, "very strong"], [0.29951, "weak"],
    [0.0996, "very weak"], [0.0994, "negligible"], [0, "negligible"],
  ])("labels r = %s by its displayed value as %s", (r, label) => {
    expect(strengthLabel(r)).toBe(label);
    expect(strengthLabel(Number(formatR(r).replace("−", "-")))).toBe(label);
  });

  it("describes negligible associations without a direction", () => {
    expect(strengthPhrase(0.04, "positive")).toBe("negligible");
    expect(strengthPhrase(-0.65, "negative")).toBe("moderate, negative");
  });

  it("uses the displayed-value label even when an older sealed result stored another", () => {
    const interp = buildInterpretation(["A", "B"], "spearman", 0.05, [{
      trait_1: "A", trait_2: "B", n: 40, estimable: true, r: 0.6996, p_raw: 0.001, p_adjusted: 0.001,
      significant_raw: true, significant_adjusted: true, strength: "moderate", direction: "positive", flags: [],
    }], { n_hypotheses: 1 });
    expect(interp.items[0].text).toContain("ρ = 0.700 (strong, positive)");
    expect(interp.items[0].text).not.toMatch(/switch to Spearman|consider Spearman/i);
  });
});

describe("pair rows", () => {
  const dataset = {
    headers: ["Yield", "Height", "Note"],
    rows: [[1, 10, "a"], ["", 11, "b"], [3, "NA", "c"], ["4", "14", "d"], ["1,5", 15, "e"], [6, "0x10", "f"], [7, 20, "g"]],
  };

  it("reads numbers the way pandas.to_numeric does", () => {
    expect(toFiniteNumber("4")).toBe(4);
    expect(toFiniteNumber(" 2.5e1 ")).toBe(25);
    for (const v of ["", "NA", "1,5", "0x10", "Infinity", null, true]) expect(toFiniteNumber(v)).toBeNull();
  });

  it("keeps only pairwise-complete rows with their 1-based data row numbers", () => {
    expect(pairCompleteRows(dataset, "Yield", "Height")).toEqual([
      { dataRow: 1, x: 1, y: 10 }, { dataRow: 4, x: 4, y: 14 }, { dataRow: 7, x: 7, y: 20 },
    ]);
  });

  it("refuses to plot when the rows cannot reproduce the coefficient's n", () => {
    expect(pairScatterData(dataset, "Yield", "Height", 3).status).toBe("ok");
    const mismatch = pairScatterData(dataset, "Yield", "Height", 4);
    expect(mismatch.status).toBe("unavailable");
    expect(pairScatterData({ ...dataset, headers: ["Yield", "Yield", "Note"] }, "Yield", "Height", 3).status).toBe("unavailable");
  });
});

const CSV = "Yield,Height,Days\n1,10,5\n2,,6\n3,15,5\n4,14,7\n5,20,\n6,21,8\nNA,9,9\n";
const result = (n: number) => ({
  analysis_context: "general", method: "spearman", alpha: 0.05, trait_names: ["Yield", "Height"],
  pair_results: [{ trait_1: "Yield", trait_2: "Height", n, estimable: true, r: 0.9, p_raw: null, p_adjusted: null,
    significant_adjusted: null, strength: "very strong", direction: "positive", flags: ["spearman_inference_withheld"] }],
  multiplicity: { n_hypotheses: 0, n_pairs_not_estimable: 0, n_pairs_inference_withheld: 1 }, phenotypic: { n_observations: 7 },
  warnings: [], result_integrity: { scheme: "relationship-seal-v1", key_id: "k", mac: "m" },
});

async function runWith(response: unknown) {
  requestMock.mockResolvedValueOnce(response);
  render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Upload general correlation dataset"), {
      target: { files: [new File([CSV], "trial.csv", { type: "text/csv" })] },
    });
  });
  await waitFor(() => expect(screen.getByLabelText("Variable Yield")).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText("Variable Yield"));
  fireEvent.click(screen.getByLabelText("Variable Height"));
  fireEvent.change(screen.getByLabelText("Correlation method"), { target: { value: "spearman" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Run General Correlation/ })); });
  return screen.findByTestId("general-pair-table");
}

beforeEach(() => requestMock.mockReset());

describe("on-demand pair scatterplot", () => {
  it("opens from the pair row, shows n and both axis variables, and closes again", async () => {
    const table = await runWith(result(5)); // complete Yield/Height rows: 1,3,4,5,6
    const button = within(table).getByRole("button", { name: "Show scatterplot of Yield and Height" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("general-pair-scatterplot")).toBeNull();

    fireEvent.click(button);
    const figure = screen.getByTestId("general-pair-scatterplot");
    expect(within(figure).getByTestId("general-pair-scatterplot-n")).toHaveTextContent("n = 5");
    expect(figure).toHaveTextContent("the same rows used for this coefficient");
    expect(figure).toHaveTextContent("ranks of these values");
    expect(within(figure).getByRole("img")).toHaveAccessibleName(
      "Scatterplot of Height (vertical axis) against Yield (horizontal axis), 5 points",
    );
    expect(within(table).getByRole("button", { name: "Hide scatterplot of Yield and Height" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(figure).getByRole("button", { name: "Close plot" }));
    expect(screen.queryByTestId("general-pair-scatterplot")).toBeNull();
  });

  it("withholds the plot if the rows do not match the reported n", async () => {
    const table = await runWith(result(6));
    fireEvent.click(within(table).getByRole("button", { name: "Show scatterplot of Yield and Height" }));
    expect(screen.getByTestId("general-pair-scatterplot-unavailable")).toHaveTextContent("found 5");
    expect(within(screen.getByTestId("general-pair-scatterplot")).queryByRole("img")).toBeNull();
  });

  it("states the strength convention with the results", async () => {
    await runWith(result(5));
    expect(screen.getByTestId("general-results-strength")).toHaveTextContent("not its significance");
    expect(screen.getByTestId("general-strength-convention")).toHaveTextContent(STRENGTH_CONVENTION_NOTE);
  });
});
