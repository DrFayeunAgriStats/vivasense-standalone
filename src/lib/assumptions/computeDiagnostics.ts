// Pure helpers for ANOVA assumption diagnostics.
// Parses backend `assumptions` payloads (object or array-of-array), computes
// box-plot summaries, residual reconstructions, normal-curve density, and
// theoretical quantiles for Q-Q plots.

export interface TestResult {
  test: string;
  statistic: number | null;
  pValue: number | null;
  passed: boolean | null;
  method?: string;
}

export interface AssumptionSummary {
  shapiro: TestResult | null;
  levene: TestResult | null;
  /** Overall pass = both available tests passed (p > 0.05). Null when no tests. */
  overall: "pass" | "warn" | "unknown";
}

export interface BoxPlotDatum {
  group: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean?: number;
  sd?: number;
  n?: number;
  outliers: number[];
}

export interface ResidualPoint {
  group: string;
  observed: number;
  fitted: number;
  residual: number;
}

// ───────── helpers ─────────

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
};

const parsePValue = (v: unknown): number | null => {
  if (typeof v === "string") {
    const m = v.trim().match(/^<?\s*([\d.eE+-]+)/);
    if (m) {
      const n = parseFloat(m[1]);
      return isNaN(n) ? null : n;
    }
  }
  return numOrNull(v);
};

// ───────── assumption-test parsing ─────────

export function parseAssumptions(raw: unknown): AssumptionSummary {
  const out: AssumptionSummary = { shapiro: null, levene: null, overall: "unknown" };
  if (!raw) return out;

  const classify = (testName: string, statistic: unknown, pValue: unknown, method?: string) => {
    const stat = numOrNull(statistic);
    const p = parsePValue(pValue);
    const passed = p == null ? null : p > 0.05;
    const lower = testName.toLowerCase();
    const result: TestResult = { test: testName, statistic: stat, pValue: p, passed, method };
    if (/shapiro|anderson|normality|kolmogorov/.test(lower)) {
      if (!out.shapiro) out.shapiro = result;
    } else if (/levene|bartlett|homogeneity|brown.?forsythe/.test(lower)) {
      if (!out.levene) out.levene = result;
    }
  };

  // Array of arrays (header row + data)
  if (Array.isArray(raw) && raw.length > 1 && Array.isArray(raw[0])) {
    const headers = (raw[0] as string[]).map((h) => String(h).toLowerCase());
    const testIdx = headers.findIndex((h) => /test|assumption/.test(h));
    const statIdx = headers.findIndex((h) => /^stat|statistic|^w$|^f$/.test(h));
    const pIdx = headers.findIndex((h) => /p.?value|^p$/.test(h));
    const methodIdx = headers.findIndex((h) => /method/.test(h));
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      const name = testIdx >= 0 ? String(row[testIdx] ?? "") : "";
      if (!name) continue;
      classify(
        name,
        statIdx >= 0 ? row[statIdx] : null,
        pIdx >= 0 ? row[pIdx] : null,
        methodIdx >= 0 ? String(row[methodIdx]) : undefined,
      );
    }
  }
  // Array of row objects
  else if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    for (const row of raw as Record<string, unknown>[]) {
      const name = String(row.test ?? row.Test ?? row.name ?? row.assumption ?? "");
      const stat = row.statistic ?? row.Statistic ?? row.stat ?? row.W ?? row.F;
      const p = row.p_value ?? row["p-value"] ?? row.pvalue ?? row.p ?? row["Pr(>F)"];
      if (name) classify(name, stat, p, row.method as string | undefined);
    }
  }
  // Nested object: { shapiro: { statistic, p_value }, levene: { ... } }
  else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      const stat = v.statistic ?? v.W ?? v.F ?? v.stat;
      const p = v.p_value ?? v["p-value"] ?? v.pvalue ?? v.p;
      classify(key, stat, p, v.method as string | undefined);
    }
  }

  const tests = [out.shapiro, out.levene].filter((t): t is TestResult => !!t && t.passed !== null);
  if (tests.length > 0) {
    out.overall = tests.every((t) => t.passed) ? "pass" : "warn";
  }
  return out;
}

// ───────── descriptive_stats → box plot ─────────

export function buildBoxPlotData(descStats: unknown, rawRows?: ResidualPoint[]): BoxPlotDatum[] {
  // Prefer raw observations (true quartiles + outliers)
  if (rawRows && rawRows.length > 0) {
    const groups = new Map<string, number[]>();
    rawRows.forEach((r) => {
      const arr = groups.get(r.group) ?? [];
      arr.push(r.observed);
      groups.set(r.group, arr);
    });
    return Array.from(groups.entries()).map(([group, vals]) => summarizeBox(group, vals));
  }

  // Fallback: parse descriptive_stats rows
  if (!Array.isArray(descStats)) return [];
  return (descStats as Record<string, unknown>[])
    .map((row) => {
      const group = String(
        row.treatment ?? row.Treatment ?? row.genotype ?? row.Genotype ?? row.group ?? row.Group ?? row.level ?? Object.values(row)[0] ?? "",
      );
      const mean = numOrNull(row.mean ?? row.Mean);
      const sd = numOrNull(row.sd ?? row.SD ?? row.std ?? row.Std);
      const min = numOrNull(row.min ?? row.Min);
      const max = numOrNull(row.max ?? row.Max);
      const median = numOrNull(row.median ?? row.Median ?? row.med) ?? mean;
      const q1 = numOrNull(row.q1 ?? row.Q1 ?? row["25%"]) ?? (mean != null && sd != null ? mean - 0.6745 * sd : null);
      const q3 = numOrNull(row.q3 ?? row.Q3 ?? row["75%"]) ?? (mean != null && sd != null ? mean + 0.6745 * sd : null);
      const n = numOrNull(row.n ?? row.N ?? row.count);
      if (!group || median == null || min == null || max == null || q1 == null || q3 == null) return null;
      return {
        group,
        min,
        q1,
        median,
        q3,
        max,
        mean: mean ?? undefined,
        sd: sd ?? undefined,
        n: n ?? undefined,
        outliers: [],
      } as BoxPlotDatum;
    })
    .filter((x): x is BoxPlotDatum => x !== null);
}

function summarizeBox(group: string, vals: number[]): BoxPlotDatum {
  const sorted = [...vals].sort((a, b) => a - b);
  const q = (p: number) => {
    if (sorted.length === 0) return 0;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const q1 = q(0.25);
  const median = q(0.5);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const outliers = sorted.filter((v) => v < lo || v > hi);
  const inliers = sorted.filter((v) => v >= lo && v <= hi);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
  return {
    group,
    min: inliers[0] ?? sorted[0],
    q1,
    median,
    q3,
    max: inliers[inliers.length - 1] ?? sorted[sorted.length - 1],
    mean,
    sd,
    n: vals.length,
    outliers,
  };
}

// ───────── residuals (frontend reconstruction) ─────────

export interface RawObservation {
  group: string;
  value: number;
}

/** Compute residuals = y − treatment mean. Returns ResidualPoint[]. */
export function computeResiduals(rows: RawObservation[]): ResidualPoint[] {
  if (!rows.length) return [];
  const grouped = new Map<string, number[]>();
  rows.forEach((r) => {
    const arr = grouped.get(r.group) ?? [];
    arr.push(r.value);
    grouped.set(r.group, arr);
  });
  const means = new Map<string, number>();
  grouped.forEach((vals, g) => {
    means.set(g, vals.reduce((a, b) => a + b, 0) / vals.length);
  });
  return rows.map((r) => {
    const fitted = means.get(r.group) ?? 0;
    return { group: r.group, observed: r.value, fitted, residual: r.value - fitted };
  });
}

// ───────── histogram + normal curve ─────────

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binMid: number;
  count: number;
  normal: number;
}

export function buildHistogram(values: number[], binCount = 12): HistogramBin[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / binCount;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, values.length - 1));
  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const binMid = binStart + binWidth / 2;
    const count = values.filter((v) => (i === binCount - 1 ? v >= binStart && v <= binEnd : v >= binStart && v < binEnd)).length;
    const normalDensity = sd > 0 ? (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((binMid - mean) / sd) ** 2) : 0;
    const normalCount = normalDensity * values.length * binWidth;
    bins.push({ binStart, binEnd, binMid, count, normal: normalCount });
  }
  return bins;
}

// ───────── Q-Q plot ─────────

export interface QQPoint {
  theoretical: number;
  sample: number;
}

// Standard normal inverse CDF (Acklam approximation).
function invNorm(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

export function buildQQPoints(values: number[]): QQPoint[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return sorted.map((v, i) => ({
    theoretical: invNorm((i + 0.5) / n),
    sample: v,
  }));
}
