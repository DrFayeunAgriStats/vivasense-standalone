import { vivaSenseRequest } from "@/services/vivasenseApiClient";

export const REGRESSION_PATH = "/relationship-analysis/regression";
export const regressionEnabled = import.meta.env.VITE_SIMPLE_LINEAR_REGRESSION === "true";
const endpoint = "/analysis/regression";

type Diagnostic = {
  test_name: string;
  p_value: number | null;
  interpretation: string;
};

export interface SimpleRegressionResult {
  status: "success";
  x_variable: string;
  y_variable: string;
  n: number;
  alpha: number;
  confidence_level: number;
  equation: string;
  intercept: number;
  slope: number;
  standard_error_slope: number;
  p_value_slope: number;
  confidence_interval_slope: { lower: number; upper: number };
  r_squared: number;
  adjusted_r_squared: number;
  plain_language_effect: string;
  summary_interpretation: string;
  warnings: string[];
  diagnostics: { residual_normality: Diagnostic; heteroscedasticity: Diagnostic };
  plot_data: { x: number[]; y: number[]; fitted_y: number[] };
}

export async function previewRegression(file: File) {
  const body = new FormData();
  body.append("file", file);
  return vivaSenseRequest<{ dataset_token: string; numeric_columns: string[] }>(
    `${endpoint}/preview`, { method: "POST", body },
  );
}

export async function fitSimpleRegression(dataset_token: string, x_variable: string, y_variable: string, alpha: number) {
  const result = await vivaSenseRequest<SimpleRegressionResult>(endpoint, {
    method: "POST",
    jsonBody: { dataset_token, x_variable, y_variable, alpha },
  });
  if (result.status !== "success" || result.x_variable !== x_variable || result.y_variable !== y_variable
      || result.alpha !== alpha || result.confidence_level !== 1 - alpha || !result.diagnostics) {
    throw new Error("The server returned a result that does not match this regression request.");
  }
  return result;
}

const number = (value: number) => Number(value.toPrecision(6)).toString();
const pValue = (value: number) => value < 0.0001 ? "< 0.0001" : value.toFixed(4);
export const REGRESSION_SCOPE = "Use one row per independent observation. This model assumes a straight-line relationship and does not account for blocks, clustered data or repeated measurements. Classical slope inference assumes constant residual variance and normally distributed errors.";

export function regressionReport(result: SimpleRegressionResult) {
  const ci = result.confidence_interval_slope;
  const level = Math.round(result.confidence_level * 100);
  return [
    {
      title: "Model and slope inference",
      rows: [
        ["Predictor (X)", result.x_variable],
        ["Response (Y)", result.y_variable],
        ["Complete pairs", String(result.n)],
        ["Significance level (α)", String(result.alpha)],
        ["Fitted equation", result.equation],
        ["Intercept", number(result.intercept)],
        ["Slope", number(result.slope)],
        ["Slope standard error", number(result.standard_error_slope)],
        ["Slope p-value", pValue(result.p_value_slope)],
        [`${level}% slope confidence interval`, `[${number(ci.lower)}, ${number(ci.upper)}]`],
        ["R²", number(result.r_squared)],
        ["Adjusted R²", number(result.adjusted_r_squared)],
      ],
    },
    {
      title: "Residual diagnostics",
      rows: Object.values(result.diagnostics).map((diagnostic) => [
        diagnostic.test_name,
        diagnostic.p_value === null ? diagnostic.interpretation :
          `p ${pValue(diagnostic.p_value).startsWith("<") ? "" : "= "}${pValue(diagnostic.p_value)}. ${diagnostic.interpretation}`,
      ]),
    },
    {
      title: "Interpretation",
      rows: [
        ["Slope", result.plain_language_effect],
        ["Model", result.summary_interpretation],
        ["Assumptions", REGRESSION_SCOPE],
        ...result.warnings.map((warning) => ["Caution", warning]),
      ],
    },
  ];
}
