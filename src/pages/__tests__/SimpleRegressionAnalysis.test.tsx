vi.mock("@/services/history/historyService", () => ({ recordAnalysis: vi.fn(), recordAnalysisFailure: vi.fn() }));
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { regressionReport, type SimpleRegressionResult } from "@/lib/simpleRegression";
import SimpleRegressionAnalysis from "../SimpleRegressionAnalysis";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/services/vivasenseApiClient", () => ({ vivaSenseRequest: request }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("recharts", async (importOriginal) => ({ ...await importOriginal<typeof import("recharts")>(), ResponsiveContainer: () => null }));

it("reports the fitted model at the requested alpha and clears it when settings change", async () => {
  const diagnostic = { test_name: "Diagnostic", p_value: 0.2, interpretation: "No clear evidence of a violation." };
  const fitted: SimpleRegressionResult = {
    status: "success", x_variable: "Height", y_variable: "Yield", n: 12,
    alpha: 0.10, confidence_level: 0.90, equation: "Yield = 3 + 2 × Height",
    intercept: 3, slope: 2, r_squared: 0.7, adjusted_r_squared: 0.67,
    standard_error_slope: 0.2, p_value_slope: 0.002,
    confidence_interval_slope: { lower: 1.5, upper: 2.5 },
    plain_language_effect: "Height was associated with yield.",
    summary_interpretation: "The fit describes the observed data.", warnings: [],
    diagnostics: { residual_normality: { ...diagnostic, test_name: "Shapiro-Wilk" }, heteroscedasticity: diagnostic },
    plot_data: { x: [0, 1], y: [3, 6], fitted_y: [3, 5] },
  };
  request.mockResolvedValueOnce({ dataset_token: "token", numeric_columns: ["Height", "Yield"] });
  request.mockResolvedValueOnce(fitted);

  render(<MemoryRouter><SimpleRegressionAnalysis /></MemoryRouter>);
  const run = screen.getByRole("button", { name: "Run Regression" });
  expect(run).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Dataset/), { target: { files: [new File(["Height,Yield"], "trial.csv")] } });
  fireEvent.change(await screen.findByLabelText("Predictor (X)"), { target: { value: "Height" } });
  fireEvent.change(screen.getByLabelText("Response (Y)"), { target: { value: "Yield" } });
  fireEvent.change(screen.getByLabelText("Significance level (α)"), { target: { value: "0.1" } });
  fireEvent.click(run);

  expect(await screen.findByText("90% slope confidence interval")).toBeInTheDocument();
  expect(screen.getByText("[1.5, 2.5]")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download Word report" })).toBeEnabled();
  expect(regressionReport(fitted)[0].rows).toContainEqual(["90% slope confidence interval", "[1.5, 2.5]"]);
  expect(request).toHaveBeenNthCalledWith(2, "/analysis/regression", {
    method: "POST", jsonBody: { dataset_token: "token", x_variable: "Height", y_variable: "Yield", alpha: 0.10 },
  });
  fireEvent.change(screen.getByLabelText("Significance level (α)"), { target: { value: "0.05" } });
  expect(screen.queryByRole("button", { name: "Download Word report" })).not.toBeInTheDocument();
});
