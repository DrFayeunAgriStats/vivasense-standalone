/**
 * REL-UI-02 — General Correlation presentation (display only; mocked backend).
 * The interpretation wording mirrors the backend Word report
 * (genetics-module/test_rel_ui_02_general_presentation.py pins the same strings).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const requestMock = vi.fn();
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: (...a: unknown[]) => requestMock(...a) }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import GeneralCorrelationAnalysis from "../GeneralCorrelationAnalysis";
import {
  DESIGN_COLUMN_WARNING, buildInterpretation, formatP, formatR, isDesignColumn, pPhrase, pairState,
  significanceLabel, stateMark, type PresentationPair,
} from "@/lib/generalCorrelationPresentation";
import { SCOPE_CAUTION } from "@/lib/generalCorrelationCautions";

const CSV =
  "Genotype,Rep,BLOCK,Plot number,Row,Grain yield (t/ha),Plant height (cm),Days\n" +
  "G1,1,1,101,1,4.1,90,60\nG1,2,2,102,2,4.4,93,61\nG2,1,1,103,3,3.9,88,62\n" +
  "G2,2,2,104,4,4.8,97,59\nG3,1,1,105,5,5.0,99,58\nG3,2,2,106,6,4.6,95,60\n";

const pair = (a: string, b: string, o: Partial<PresentationPair> = {}): PresentationPair => ({
  trait_1: a, trait_2: b, n: 20, r: 0.5, p_raw: 0.01, p_adjusted: 0.02, significant_raw: true,
  significant_adjusted: true, estimable: true, strength: "moderate", direction: "positive", flags: [], reason: null, ...o,
});

const T = ["Grain yield (t/ha)", "Plant height (cm)", "Days"];
const RESULT = {
  analysis_context: "general", method: "pearson", alpha: 0.05, trait_names: T,
  pair_results: [
    pair(T[0], T[1], { n: 6, r: 0.9871, p_raw: 0.00002, p_adjusted: 0.00006, strength: "very strong" }),
    pair(T[0], T[2], { n: 6, r: -0.61, p_raw: 0.04, p_adjusted: 0.06, significant_adjusted: false, direction: "negative" }),
    pair(T[1], T[2], { n: 5, r: -0.2, p_raw: 0.7, p_adjusted: 0.7, significant_raw: false, significant_adjusted: false, direction: "negative", strength: "weak" }),
  ],
  multiplicity: { n_hypotheses: 3, n_pairs_not_estimable: 0 }, phenotypic: { n_observations: 6 },
  warnings: [], interpretation: "ENGINE TEXT (not rendered as a paragraph)",
  result_integrity: { scheme: "relationship-seal-v1", key_id: "sha256:x", mac: "m" },
};

async function upload() {
  render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Upload general correlation dataset"), {
      target: { files: [new File([CSV], "trial.csv", { type: "text/csv" })] },
    });
  });
  await waitFor(() => expect(screen.getByLabelText(`Variable ${T[0]}`)).toBeInTheDocument());
}

async function runWith(result: Record<string, unknown>) {
  requestMock.mockResolvedValueOnce(result);
  await upload();
  for (const t of T) fireEvent.click(screen.getByLabelText(`Variable ${t}`));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Run General Correlation/ })); });
  await screen.findByTestId("general-matrix");
}

beforeEach(() => requestMock.mockReset());

describe("p-value rule (item 6)", () => {
  it("uses four decimals and < 0.0001, without rounding stored values", () => {
    expect([null, 0, 0.00004, 0.0001, 0.000149, 0.01234, 0.05, 0.99996].map(formatP))
      .toEqual(["—", "< 0.0001", "< 0.0001", "0.0001", "0.0001", "0.0123", "0.0500", "1.0000"]);
    expect(pPhrase(0.00001)).toBe("< 0.0001");
    expect(pPhrase(0.0388)).toBe("= 0.0388");
    expect(formatR(-0.51)).toBe("−0.510");
  });

  it("applies the rule in the web table and the interpretation", async () => {
    await runWith(RESULT);
    const table = screen.getByTestId("general-pair-table");
    expect(table).toHaveTextContent("< 0.0001");
    expect(table).toHaveTextContent("0.0400");
    expect(table).not.toHaveTextContent("<0.001");
    expect(screen.getByTestId("general-interpretation-pairs")).toHaveTextContent("raw p < 0.0001, FDR-adjusted p < 0.0001");
  });
});

describe("design columns (item 2)", () => {
  it("excludes exact, case-insensitive design names only", () => {
    for (const n of ["Rep", "replication", "BLOCK", "Plot", " row ", "Column"]) expect(isDesignColumn(n)).toBe(true);
    for (const n of ["Plot number", "Rows planted", "Block yield", "Reps"]) expect(isDesignColumn(n)).toBe(false);
  });

  it("hides them by default and offers an explicit opt-in with a warning", async () => {
    await upload();
    expect(screen.queryByLabelText("Variable Rep")).toBeNull();
    expect(screen.queryByLabelText("Variable BLOCK")).toBeNull();
    expect(screen.queryByLabelText("Variable Row")).toBeNull();
    expect(screen.getByLabelText("Variable Plot number")).toBeInTheDocument();     // not an exact design name
    expect(screen.queryByTestId("general-design-warning")).toBeNull();
    expect(screen.getByTestId("general-design-columns")).toHaveTextContent("Rep, BLOCK, Row");

    fireEvent.click(screen.getByLabelText("Show design columns"));
    expect(screen.getByLabelText("Variable Rep")).toBeInTheDocument();
    expect(screen.getByTestId("general-design-warning")).toHaveTextContent(DESIGN_COLUMN_WARNING);
    expect(DESIGN_COLUMN_WARNING).toContain("not automatically quantitative traits");

    fireEvent.click(screen.getByLabelText("Variable Rep"));
    fireEvent.click(screen.getByLabelText("Show design columns"));                 // opt out again
    expect(screen.queryByLabelText("Variable Rep")).toBeNull();
    fireEvent.click(screen.getByLabelText("Show design columns"));
    expect(screen.getByLabelText("Variable Rep")).not.toBeChecked();               // deselected on opt-out
  });
});

describe("structured interpretation (item 1)", () => {
  it("renders a summary paragraph and one list item per pair from pair results", async () => {
    await runWith(RESULT);
    const box = screen.getByTestId("general-interpretation");
    expect(box).not.toHaveTextContent("ENGINE TEXT");
    expect(screen.getByTestId("general-interpretation-summary")).toHaveTextContent(
      "3 numeric variables (3 variable pairs) using Pearson correlation");
    expect(screen.getByTestId("general-interpretation-summary")).toHaveTextContent("1 pair was significant after adjustment");
    const items = within(screen.getByTestId("general-interpretation-pairs")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual(["significant", "not_significant", "not_significant"]);
    expect(items[1]).toHaveTextContent("after adjustment for the 3 simultaneous tests");
    expect(items[2]).toHaveTextContent("this is not evidence that the variables are unrelated");
    expect(box).toHaveTextContent("does not establish causation");
  });

  it("matches the Word report wording and uses correct singular forms", () => {
    const one = buildInterpretation(["A", "B"], "pearson", 0.05, [pair("A", "B")], { n_hypotheses: 1 });
    expect(one.summary).toContain("2 numeric variables (1 variable pair)");
    expect(one.summary).toContain("1 pair was tested; Benjamini–Hochberg false discovery rate (FDR) adjustment was applied across this test");
    expect(one.summary).not.toContain("(s)");
    expect(one.items[0]).toEqual({
      label: "A × B", state: "significant",
      text: "r = 0.500 (moderate, positive), n = 20; raw p = 0.0100, FDR-adjusted p = 0.0200. The data provide statistical evidence of a positive association at α = 0.05 after FDR adjustment.",
    });
  });

  it("keeps withheld Spearman and not-estimable pairs distinct", () => {
    const out = buildInterpretation(["A", "B", "C"], "spearman", 0.05, [
      pair("A", "B", { n: 8, r: 0.83, p_raw: null, p_adjusted: null, significant_raw: null, significant_adjusted: null, strength: "strong" }),
      pair("A", "C", { n: 2, r: null, p_raw: null, p_adjusted: null, significant_adjusted: null, estimable: false, reason: "only 2 pairwise-complete observations" }),
      pair("B", "C", { n: 30, r: 0.1, p_raw: 0.6, p_adjusted: 0.6, significant_raw: false, significant_adjusted: false }),
    ], { n_hypotheses: 1 });
    expect(out.items.map((i) => i.state)).toEqual(["not_assessed", "not_estimable", "not_significant"]);
    expect(out.items[0].text).toContain("descriptive only");
    expect(out.items[1].text).toBe("not estimated – only 2 pairwise-complete observations.");
    expect(out.summary).toContain("For 1 pair, Spearman p-values");
    expect(out.summary).toContain("1 pair could not be estimated");
  });
});

describe("lower-triangle matrix (items 8–9)", () => {
  it("shows r, a marker from the FDR-adjusted decision only, and pairwise n; no upper triangle or diagonal", async () => {
    await runWith(RESULT);
    const matrix = screen.getByTestId("general-matrix");
    expect(matrix).toHaveTextContent("lower triangle, diagonal omitted");
    expect(matrix).toHaveTextContent("pairwise n ranges from 5 to 6");
    expect(screen.getByTestId("general-matrix-cell-1-0")).toHaveTextContent("0.987*n = 6");
    expect(screen.getByTestId("general-matrix-cell-2-0")).toHaveTextContent("−0.610n = 6");   // raw p < α, adjusted not: no marker
    expect(screen.getByTestId("general-matrix-cell-2-1")).toHaveTextContent("−0.200n = 5");
    expect(screen.queryByTestId("general-matrix-cell-0-0")).toBeNull();
    expect(screen.queryByTestId("general-matrix-cell-1-1")).toBeNull();
    expect(screen.getByTestId("general-matrix-legend")).toHaveTextContent("* FDR-adjusted p < 0.05 (Benjamini–Hochberg across 3 tests)");
  });

  it("marks not-assessed (†) and not-estimable (—) cells distinctly", async () => {
    await runWith({
      ...RESULT, method: "spearman",
      pair_results: [
        pair(T[0], T[1], { n: 6, r: 0.83, p_raw: null, p_adjusted: null, significant_raw: null, significant_adjusted: null }),
        pair(T[0], T[2], { n: 1, r: null, p_raw: null, p_adjusted: null, significant_adjusted: null, estimable: false, reason: "too few" }),
        pair(T[1], T[2], { n: 6, r: 0.1, p_raw: null, p_adjusted: null, significant_raw: null, significant_adjusted: null }),
      ],
      multiplicity: { n_hypotheses: 0, n_pairs_inference_withheld: 2 },
    });
    expect(screen.getByTestId("general-matrix-cell-1-0")).toHaveTextContent("0.830†");
    expect(screen.getByTestId("general-matrix-cell-2-0")).toHaveTextContent("—n = 1");
    const legend = screen.getByTestId("general-matrix-legend");
    expect(legend).toHaveTextContent("† significance not assessed");
    expect(legend).toHaveTextContent("— not estimable");
    const table = screen.getByTestId("general-pair-table");
    expect(table).toHaveTextContent("not assessed");
    expect(table).toHaveTextContent("not estimable");
    expect(screen.getByTestId("general-inference-basis")).toHaveTextContent("0 inferentially eligible variable pairs (2 pairs with inference withheld)");
  });
});

describe("cautions and labels (item 7)", () => {
  it("keeps the full design caution before analysis and shortens the reminders after the results", async () => {
    await runWith(RESULT);
    expect(screen.getByTestId("general-scope-caution")).toHaveTextContent(SCOPE_CAUTION);
    const notes = screen.getByTestId("general-results-notes");
    expect(notes.textContent ?? "").not.toContain(SCOPE_CAUTION);
    expect((notes.textContent ?? "").length).toBeLessThan(SCOPE_CAUTION.length + 300);
    expect(notes).toHaveTextContent("full cautions appear above the analysis form and in the Word report");
  });

  it("uses singular labels for one pair", async () => {
    await runWith({ ...RESULT, pair_results: [RESULT.pair_results[0]], multiplicity: { n_hypotheses: 1 } });
    expect(screen.getByTestId("general-inference-basis")).toHaveTextContent("across 1 inferentially eligible variable pair;");
    expect(screen.getByTestId("general-inference-basis")).not.toHaveTextContent("pair(s)");
  });
});

describe("acceptance audit: edge cases", () => {
  it("never shows a missing or non-finite p-value as an ordinary test", () => {
    expect([NaN, Infinity, -0.1].map(formatP)).toEqual(["—", "—", "—"]);
    const nanAdj = pair("A", "B", { p_adjusted: NaN, significant_adjusted: false });
    expect(pairState(nanAdj)).toBe("not_assessed");
    expect(significanceLabel(nanAdj)).toBe("not assessed");
    expect(stateMark(pair("A", "B", { p_adjusted: null, significant_adjusted: true }))).toBe("†");
    expect(pairState(pair("A", "B", { r: NaN }))).toBe("not_estimable");
  });

  it("takes the marker from the adjusted decision only", () => {
    const e = pair("A", "B", { p_raw: 0.01, p_adjusted: 0.2, significant_raw: true, significant_adjusted: false });
    expect(stateMark(e)).toBe("");
    expect(significanceLabel(e)).toBe("not significant");
  });

  it("does not offer columns whose header occurs more than once", async () => {
    render(<MemoryRouter><GeneralCorrelationAnalysis /></MemoryRouter>);
    const csv = "Yield,Yield,Height,Days\n1,2,3,4\n2,3,4,5\n3,5,6,6\n4,4,8,7\n5,6,9,9\n6,8,9,9\n";
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Upload general correlation dataset"), {
        target: { files: [new File([csv], "dup.csv", { type: "text/csv" })] },
      });
    });
    await waitFor(() => expect(screen.getByLabelText("Variable Height")).toBeInTheDocument());
    expect(screen.queryByLabelText("Variable Yield")).toBeNull();
    expect(screen.getByTestId("general-duplicate-headers")).toHaveTextContent("Yield");
  });

  it("shows a backend column-identity refusal verbatim", async () => {
    const msg = "Column identity is ambiguous: the headers 'Yield (t/ha)', 'Yield t/ha' cannot be told apart once standardised (each becomes 'Yield_t_ha'), so 'Yield t/ha' cannot be matched to a single column. Rename the columns so that each header is distinct, then upload the file again.";
    requestMock.mockRejectedValueOnce(new Error(msg));
    await upload();
    for (const t of T) fireEvent.click(screen.getByLabelText(`Variable ${t}`));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Run General Correlation/ })); });
    await waitFor(() => expect(screen.getByTestId("general-error-detail")).toHaveTextContent(msg));
  });
});
