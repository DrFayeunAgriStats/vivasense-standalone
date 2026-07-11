import type { AssumptionSummary, BoxPlotDatum, ResidualPoint, TestResult } from "./computeDiagnostics";

const fmtP = (p: number | null): string => {
  if (p == null) return "n/a";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
};

export function interpretShapiro(t: TestResult | null): string {
  if (!t) return "Normality test not available for this analysis.";
  const w = t.statistic != null ? t.statistic.toFixed(3) : "—";
  if (t.passed === true) {
    return `Shapiro–Wilk W = ${w}, p = ${fmtP(t.pValue)}. Residuals do not significantly deviate from normality (p > 0.05).`;
  }
  if (t.passed === false) {
    return `Shapiro–Wilk W = ${w}, p = ${fmtP(t.pValue)}. Residuals depart from normality (p ≤ 0.05); inspect Q-Q plot and consider transformation.`;
  }
  return `Shapiro–Wilk W = ${w}.`;
}

export function interpretLevene(t: TestResult | null): string {
  if (!t) return "Homogeneity-of-variance test not available for this analysis.";
  const f = t.statistic != null ? t.statistic.toFixed(3) : "—";
  if (t.passed === true) {
    return `Levene F = ${f}, p = ${fmtP(t.pValue)}. Variances are homogeneous across treatments (p > 0.05).`;
  }
  if (t.passed === false) {
    return `Levene F = ${f}, p = ${fmtP(t.pValue)}. Variance heterogeneity detected (p ≤ 0.05); consider Welch's ANOVA or a variance-stabilising transformation.`;
  }
  return `Levene F = ${f}.`;
}

export function interpretQQ(residuals: number[]): string {
  if (!residuals.length) return "";
  return "Points closely following the reference line indicate approximate normality of residuals.";
}

export function interpretHistogram(residuals: number[]): string {
  if (residuals.length < 3) return "";
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const skewNumer = residuals.reduce((a, b) => a + (b - mean) ** 3, 0) / residuals.length;
  const sd = Math.sqrt(residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / residuals.length);
  const skew = sd > 0 ? skewNumer / sd ** 3 : 0;
  if (Math.abs(skew) < 0.5) return "Data distribution appears approximately symmetric around zero.";
  if (skew > 0) return `Distribution is right-skewed (skewness ≈ ${skew.toFixed(2)}); a log or square-root transformation may help.`;
  return `Distribution is left-skewed (skewness ≈ ${skew.toFixed(2)}); inspect for ceiling effects.`;
}

export function interpretResidualsVsFitted(points: ResidualPoint[]): string {
  if (points.length < 4) return "";
  // Simple constant-variance check: split by fitted median, compare residual SDs.
  const sorted = [...points].sort((a, b) => a.fitted - b.fitted);
  const mid = Math.floor(sorted.length / 2);
  const lo = sorted.slice(0, mid).map((p) => p.residual);
  const hi = sorted.slice(mid).map((p) => p.residual);
  const sd = (arr: number[]) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, arr.length - 1));
  };
  const ratio = sd(hi) / Math.max(1e-9, sd(lo));
  if (ratio > 1.6 || ratio < 0.625) {
    return `Residual spread varies with fitted values (SD ratio ≈ ${ratio.toFixed(2)}); variance may not be constant.`;
  }
  return "Random scatter indicates constant variance and model adequacy.";
}

export function interpretBoxPlot(data: BoxPlotDatum[]): string {
  if (!data.length) return "";
  const totalOutliers = data.reduce((a, b) => a + b.outliers.length, 0);
  if (totalOutliers === 0) return "No severe outliers detected across treatments.";
  const groups = data.filter((d) => d.outliers.length > 0).map((d) => d.group).join(", ");
  return `${totalOutliers} outlier${totalOutliers > 1 ? "s" : ""} detected (${groups}). Verify entries and consider robust alternatives if confirmed.`;
}

export interface OverallBanner {
  level: "pass" | "warn" | "unknown";
  title: string;
  message: string;
  actions: string[];
}

export function buildOverallBanner(s: AssumptionSummary): OverallBanner {
  if (s.overall === "pass") {
    return {
      level: "pass",
      title: "✓ Assumptions satisfied",
      message: "ANOVA results can be interpreted with confidence.",
      actions: [],
    };
  }
  if (s.overall === "warn") {
    return {
      level: "warn",
      title: "⚠ Assumptions may be violated",
      message: "One or more assumption tests failed at α = 0.05.",
      actions: [
        "Consider data transformation (log, square root, arcsine).",
        "Check for extreme outliers in the box plot.",
        "Consider non-parametric alternatives where appropriate.",
      ],
    };
  }
  return {
    level: "unknown",
    title: "Assumption tests unavailable",
    message: "This analysis did not return formal assumption test statistics.",
    actions: [],
  };
}
