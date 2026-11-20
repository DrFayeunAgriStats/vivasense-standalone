import { vivaSenseRequest } from "@/services/vivasenseApiClient";

export const REGRESSION_PATH = "/relationship-analysis/regression";
export const regressionEnabled = import.meta.env.VITE_SIMPLE_LINEAR_REGRESSION === "true";
const endpoint = "/analysis/regression";

type Diagnostic = {
  test_name: string;
  p_value: number | null;
  interpretation: string;
};

export interface RegressionCoefficient {
  term: "intercept" | "slope";
  estimate: number;
  standard_error: number;
  t_statistic: number;
  p_value: number;
  ci_lower: number;
  ci_upper: number;
}

export interface RegressionAnovaRow {
  source: "Regression" | "Residual" | "Total";
  df: number;
  sum_of_squares: number;
  mean_square?: number | null;
  f_statistic?: number | null;
  p_value?: number | null;
}

export interface ObservationDiagnostic {
  /** 1-based data row in the uploaded table (header excluded). */
  source_row: number;
  x: number;
  y: number;
  fitted: number;
  residual: number;
  leverage: number | null;
  cooks_distance: number | null;
  high_leverage: boolean;
  high_influence: boolean;
}

export interface InfluenceScreening {
  status: "available" | "unavailable";
  n_parameters: number;
  leverage_threshold: number | null;
  cooks_distance_threshold: number | null;
  flagged_source_rows: number[];
  unavailable_reason: string | null;
}

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
  // REG-DIAG-02 fields. Optional: responses produced before them must still
  // render and export (they fall back to the original slope rows).
  coefficients?: RegressionCoefficient[];
  residual_standard_error?: number;
  df_residual?: number;
  anova_table?: RegressionAnovaRow[];
  observation_diagnostics?: ObservationDiagnostic[];
  influence_screening?: InfluenceScreening;
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

// ── Display precision ───────────────────────────────────────────────────────
// Estimates, statistics and diagnostics: six significant digits. p-values:
// four decimals, "< 0.0001" below that. Formatting happens only at display
// time; the stored result keeps full precision, and every decision
// (significance, screening flags) is made by the backend on unrounded values.
export const formatNumber = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : Number(value.toPrecision(6)).toString();
export const formatP = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : value < 0.0001 ? "< 0.0001" : value.toFixed(4);
const number = formatNumber;
const pValue = formatP;

// ── Shared wording (workspace and Word report) ──────────────────────────────
export const REGRESSION_SCOPE = "Use one row per independent observation. This model assumes a straight-line relationship and does not account for blocks, clustered data or repeated measurements. Classical slope inference assumes constant residual variance and normally distributed errors.";

export const MODEL_FORM_NOTE =
  "A statistically significant slope is evidence of a linear trend; it is not evidence that a straight line describes the relationship well. Check the residuals-versus-fitted plot: the residuals should scatter evenly around the zero line with no curve, funnel or cluster. A curved pattern means the straight line misrepresents the relationship even when the slope is significant.";

export const RESIDUAL_PLOT_DESCRIPTION =
  "Residuals versus fitted values: each point is one observation, plotted at its fitted value (horizontal axis) and its residual, observed minus fitted (vertical axis). The horizontal line marks a residual of zero. Observations flagged by the influence screening are drawn as orange diamonds.";

export const ROW_NUMBER_NOTE =
  "Data row numbers count the rows below the header in the uploaded file (data row 1 is spreadsheet row 2; completely blank lines in a CSV file are not counted). Rows with a missing X or Y value are not used.";

export function screeningRuleText(screening: InfluenceScreening, n: number): string {
  return (
    `Screening rule: an observation is flagged when its leverage exceeds 2p/n = ${number(screening.leverage_threshold)} ` +
    `or its Cook's distance exceeds 4/n = ${number(screening.cooks_distance_threshold)} ` +
    `(p = ${screening.n_parameters} model parameters, n = ${n}). These are conventional screening thresholds, not significance tests. ` +
    "Flagged observations remain in the fitted model: check them for data-entry or measurement errors and consider whether the conclusions depend on them. " +
    "Do not delete an observation only because it is flagged."
  );
}

export const LEVERAGE_ONE_NOTE =
  "Cook's distance is undefined (—) for an observation with leverage 1, because the fitted line passes through it exactly.";

export const INFLUENCE_LEGACY_NOTE =
  "Leverage and Cook's distance were not calculated for this result because it was produced before these diagnostics were available. Run the analysis again to obtain them.";

export function influenceUnavailableText(screening: InfluenceScreening): string {
  return `${screening.unavailable_reason ?? "Influence screening is unavailable for this model."} Leverage and Cook's distance are therefore not reported.`;
}

// ── Residual points (with legacy fallback) ──────────────────────────────────
export interface ResidualPoint {
  sourceRow: number | null;
  x: number;
  y: number;
  fitted: number;
  residual: number;
  leverage: number | null;
  cooksDistance: number | null;
  flagged: boolean;
}

/**
 * Residual points linked to their source rows. Older responses without
 * observation_diagnostics fall back to plot_data (no row link available).
 */
export function residualPoints(result: SimpleRegressionResult): ResidualPoint[] {
  if (result.observation_diagnostics?.length) {
    return result.observation_diagnostics.map((o) => ({
      sourceRow: o.source_row,
      x: o.x,
      y: o.y,
      fitted: o.fitted,
      residual: o.residual,
      leverage: o.leverage,
      cooksDistance: o.cooks_distance,
      flagged: o.high_leverage || o.high_influence,
    }));
  }
  const { x, y, fitted_y } = result.plot_data;
  return x.map((xv, i) => ({
    sourceRow: null,
    x: xv,
    y: y[i],
    fitted: fitted_y[i],
    residual: y[i] - fitted_y[i],
    leverage: null,
    cooksDistance: null,
    flagged: false,
  }));
}

// ── Report model (rendered from the same data in workspace and Word) ────────
export interface ReportTable {
  caption: string;
  columns: string[];
  /** Columns from this index on are numeric (right-aligned). */
  numericFrom: number;
  rows: string[][];
}

export interface ReportSection {
  title: string;
  rows: string[][];
  tables?: ReportTable[];
  notes?: string[];
}

function coefficientTable(result: SimpleRegressionResult, level: number): ReportTable | null {
  if (!result.coefficients?.length) return null;
  return {
    caption: `Coefficient estimates with standard errors, t-statistics, two-sided p-values and ${level}% confidence intervals (α = ${result.alpha}).`,
    columns: ["Term", "Estimate", "Standard error", "t", "p-value", `${level}% CI lower`, `${level}% CI upper`],
    numericFrom: 1,
    rows: result.coefficients.map((c) => [
      c.term === "intercept" ? "Intercept" : `Slope (${result.x_variable})`,
      number(c.estimate),
      number(c.standard_error),
      number(c.t_statistic),
      pValue(c.p_value),
      number(c.ci_lower),
      number(c.ci_upper),
    ]),
  };
}

function anovaTable(result: SimpleRegressionResult): ReportTable | null {
  if (!result.anova_table?.length) return null;
  return {
    caption: "Analysis of variance for the fitted model. The F test of the regression is the same test as the slope t test (F = t²).",
    columns: ["Source", "df", "Sum of squares", "Mean square", "F", "p-value"],
    numericFrom: 1,
    rows: result.anova_table.map((row) => [
      row.source,
      String(row.df),
      number(row.sum_of_squares),
      row.mean_square == null ? "" : number(row.mean_square),
      row.f_statistic == null ? "" : number(row.f_statistic),
      row.p_value == null ? "" : pValue(row.p_value),
    ]),
  };
}

export const INFLUENCE_TITLE = "Influential observations (screening)";

function influenceSection(result: SimpleRegressionResult): ReportSection {
  const screening = result.influence_screening;
  if (!screening || !result.observation_diagnostics) {
    return { title: INFLUENCE_TITLE, rows: [], notes: [INFLUENCE_LEGACY_NOTE] };
  }
  if (screening.status !== "available") {
    return { title: INFLUENCE_TITLE, rows: [], notes: [influenceUnavailableText(screening)] };
  }
  const notes = [screeningRuleText(screening, result.n), ROW_NUMBER_NOTE];
  if (result.observation_diagnostics.some((o) => o.leverage != null && o.cooks_distance == null)) notes.push(LEVERAGE_ONE_NOTE);
  const flagged = result.observation_diagnostics.filter((o) => o.high_leverage || o.high_influence);
  const rows: string[][] = [[
    "Flagged observations",
    flagged.length
      ? `${flagged.length} of ${result.n} (data row${flagged.length === 1 ? "" : "s"} ${flagged.map((o) => o.source_row).join(", ")})`
      : `None of the ${result.n} observations exceeded either threshold.`,
  ]];
  const tables: ReportTable[] = flagged.length ? [{
    caption: "Observations exceeding a screening threshold. All of them remain in the fitted model.",
    columns: ["Data row", result.x_variable, result.y_variable, "Fitted", "Residual", "Leverage", "Cook's distance", "Exceeds"],
    numericFrom: 1,
    rows: flagged.map((o) => [
      String(o.source_row),
      number(o.x),
      number(o.y),
      number(o.fitted),
      number(o.residual),
      number(o.leverage),
      number(o.cooks_distance),
      [o.high_leverage && "leverage", o.high_influence && "Cook's distance"].filter(Boolean).join(" and "),
    ]),
  }] : [];
  return { title: INFLUENCE_TITLE, rows, tables, notes };
}

export function regressionReport(result: SimpleRegressionResult): ReportSection[] {
  const ci = result.confidence_interval_slope;
  const level = Math.round(result.confidence_level * 100);
  const coefficients = coefficientTable(result, level);
  const anova = anovaTable(result);
  const modelRows: string[][] = [
    ["Predictor (X)", result.x_variable],
    ["Response (Y)", result.y_variable],
    ["Complete pairs", String(result.n)],
    ["Significance level (α)", String(result.alpha)],
    ["Fitted equation", result.equation],
  ];
  if (!coefficients) {
    // Older result without the coefficient table: keep the original rows.
    modelRows.push(
      ["Intercept", number(result.intercept)],
      ["Slope", number(result.slope)],
      ["Slope standard error", number(result.standard_error_slope)],
      ["Slope p-value", pValue(result.p_value_slope)],
      [`${level}% slope confidence interval`, `[${number(ci.lower)}, ${number(ci.upper)}]`],
    );
  }
  if (result.residual_standard_error != null && result.df_residual != null) {
    modelRows.push(["Residual standard error", `${number(result.residual_standard_error)} on ${result.df_residual} degrees of freedom`]);
  }
  modelRows.push(["R²", number(result.r_squared)], ["Adjusted R²", number(result.adjusted_r_squared)]);

  return [
    {
      title: "Model and slope inference",
      rows: modelRows,
      tables: [coefficients, anova].filter((t): t is ReportTable => t !== null),
    },
    {
      title: "Residual diagnostics",
      rows: Object.values(result.diagnostics).map((diagnostic) => [
        diagnostic.test_name,
        diagnostic.p_value === null ? diagnostic.interpretation :
          `p ${pValue(diagnostic.p_value).startsWith("<") ? "" : "= "}${pValue(diagnostic.p_value)}. ${diagnostic.interpretation}`,
      ]),
      notes: [MODEL_FORM_NOTE, RESIDUAL_PLOT_DESCRIPTION],
    },
    influenceSection(result),
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
