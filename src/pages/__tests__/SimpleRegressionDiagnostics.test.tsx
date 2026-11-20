/**
 * REG-DIAG-02 workspace rendering. Fixtures are real backend responses for the
 * synthetic fixture src/test/fixtures/reg_diag_synthetic_30.csv (see
 * regressionDiagnosticsResponses.json `_note`); no production data.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import fixtures from "@/test/fixtures/regressionDiagnosticsResponses.json";
import {
  INFLUENCE_LEGACY_NOTE, LEVERAGE_ONE_NOTE, MODEL_FORM_NOTE, regressionReport, residualPoints,
  type SimpleRegressionResult,
} from "@/lib/simpleRegression";
import SimpleRegressionAnalysis from "../SimpleRegressionAnalysis";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: request }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("recharts", async (importOriginal) => ({ ...await importOriginal<typeof import("recharts")>(), ResponsiveContainer: () => null }));

const curved = fixtures.curved_leaf_area as unknown as SimpleRegressionResult;
const influential = fixtures.influential_height_alpha_10 as unknown as SimpleRegressionResult;
const smallSample = fixtures.small_sample_n4 as unknown as SimpleRegressionResult;
const leverageOne = fixtures.leverage_one as unknown as SimpleRegressionResult;

/** A response as produced before REG-DIAG-02: none of the new fields. */
function legacy(result: SimpleRegressionResult): SimpleRegressionResult {
  const {
    coefficients: _c, residual_standard_error: _r, df_residual: _d, anova_table: _a,
    observation_diagnostics: _o, influence_screening: _i, ...rest
  } = result;
  return rest as SimpleRegressionResult;
}

async function renderWith(result: SimpleRegressionResult) {
  request.mockResolvedValueOnce({ dataset_token: "token", numeric_columns: [result.x_variable, result.y_variable] });
  request.mockResolvedValueOnce(result);
  render(<MemoryRouter><SimpleRegressionAnalysis /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/Dataset/), { target: { files: [new File(["x"], "fixture.csv")] } });
  fireEvent.change(await screen.findByLabelText("Predictor (X)"), { target: { value: result.x_variable } });
  fireEvent.change(screen.getByLabelText("Response (Y)"), { target: { value: result.y_variable } });
  fireEvent.change(screen.getByLabelText("Significance level (α)"), { target: { value: String(result.alpha) } });
  fireEvent.click(screen.getByRole("button", { name: "Run Regression" }));
  return screen.findByRole("region", { name: "Regression results" });
}

beforeEach(() => request.mockReset());

describe("coefficients, ANOVA and residual standard error", () => {
  it("shows both coefficients with SE, t, p and the CI level implied by alpha", async () => {
    const results = await renderWith(influential);
    const table = within(results).getByText(/Coefficient estimates/).closest("figure")!;
    expect(within(table).getByRole("columnheader", { name: "90% CI lower" })).toBeInTheDocument();
    const intercept = influential.coefficients!.find((c) => c.term === "intercept")!;
    const row = within(table).getByRole("row", { name: /Intercept/ });
    expect(row).toHaveTextContent(Number(intercept.estimate.toPrecision(6)).toString());
    expect(row).toHaveTextContent(Number(intercept.t_statistic.toPrecision(6)).toString());
    expect(within(table).getByRole("row", { name: /Slope \(Days\)/ })).toBeInTheDocument();
  });

  it("shows the model ANOVA table with degrees of freedom and the residual standard error", async () => {
    const results = await renderWith(influential);
    const anova = within(results).getByText(/Analysis of variance for the fitted model/).closest("figure")!;
    expect(within(anova).getByRole("row", { name: /^Regression 1 / })).toBeInTheDocument();
    expect(within(anova).getByRole("row", { name: /^Residual 26 / })).toBeInTheDocument();
    expect(within(anova).getByRole("row", { name: /^Total 27 / })).toBeInTheDocument();
    expect(within(results).getByText("8.01058 on 26 degrees of freedom")).toBeInTheDocument();
  });
});

describe("model form and residual diagnostics", () => {
  it("never presents a significant slope on the curved LeafArea data as evidence of good fit", async () => {
    expect(curved.p_value_slope).toBeLessThan(curved.alpha); // the trap the audit describes
    const results = await renderWith(curved);
    expect(within(results).getAllByText(MODEL_FORM_NOTE).length).toBeGreaterThan(0);
    expect(within(results).getByTestId("regression-residual-plot")).toHaveTextContent("Residuals versus fitted values");
    expect(results.textContent).not.toMatch(/fits (the data )?well|good fit|adequate fit|appropriate model/i);
  });

  it("residual points are observed − fitted and stay linked to their source rows", () => {
    const points = residualPoints(influential);
    expect(points).toHaveLength(influential.n);
    for (const p of points) {
      expect(p.sourceRow).not.toBeNull();
      expect(p.residual).toBeCloseTo(p.y - p.fitted, 10);
    }
    // Rows 7 (blank Days) and 22 (blank Height) are excluded, not renumbered.
    const rows = points.map((p) => p.sourceRow);
    expect(rows).not.toContain(7);
    expect(rows).not.toContain(22);
    expect(points.find((p) => p.sourceRow === 30)).toMatchObject({ x: 68, y: 22, flagged: true });
  });

  it("lists every observation with its data row in a keyboard-reachable table", async () => {
    const results = await renderWith(influential);
    const details = within(results).getByTestId("regression-observation-table");
    const summary = within(details).getByText(/Observation diagnostics \(28 observations\)/);
    expect(summary.tagName).toBe("SUMMARY");
    const row30 = within(details).getByRole("row", { name: /^30 68 22 / });
    expect(row30).toHaveTextContent("yes");
  });
});

describe("influence screening", () => {
  it("explains the rule, keeps the flagged row in the model and lists it", async () => {
    const results = await renderWith(influential);
    const section = within(results).getByRole("heading", { name: "Influential observations (screening)" }).closest("section")!;
    expect(section).toHaveTextContent("2p/n = 0.142857");
    expect(section).toHaveTextContent("4/n = 0.142857");
    expect(section).toHaveTextContent("not significance tests");
    expect(section).toHaveTextContent("remain in the fitted model");
    expect(section).toHaveTextContent("1 of 28 (data row 30)");
    expect(within(section).getByRole("row", { name: /^30 / })).toHaveTextContent("Cook's distance");
  });

  it("states that screening is unavailable for very small samples", async () => {
    const results = await renderWith(smallSample);
    expect(results).toHaveTextContent("needs at least 5 complete observations; this model has 4");
    expect(results).toHaveTextContent("Leverage and Cook's distance are therefore not reported.");
  });

  it("shows Cook's distance as undefined where leverage is 1", async () => {
    const results = await renderWith(leverageOne);
    expect(results).toHaveTextContent(LEVERAGE_ONE_NOTE);
  });
});

describe("older responses without the new fields", () => {
  it("still render the original slope rows, the residual plot and an explanation", async () => {
    const old = legacy(influential);
    const results = await renderWith(old);
    expect(within(results).getByText("90% slope confidence interval")).toBeInTheDocument();
    expect(within(results).getByText(INFLUENCE_LEGACY_NOTE)).toBeInTheDocument();
    expect(within(results).getByTestId("regression-residual-plot")).toBeInTheDocument();
    const details = within(results).getByTestId("regression-observation-table");
    expect(within(details).queryByRole("columnheader", { name: "Data row" })).toBeNull();
    expect(screen.getByRole("button", { name: "Download Word report" })).toBeEnabled();
    expect(regressionReport(old)[0].tables).toEqual([]);
  });
});
