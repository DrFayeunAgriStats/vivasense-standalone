/**
 * REL-UI-03 — rows behind one General Correlation coefficient, for an
 * on-demand scatterplot.
 *
 * The backend (general_correlation.compute_general_correlation) coerces each
 * selected column with pandas.to_numeric(errors="coerce"), treats non-finite
 * values as missing and then uses the pairwise-complete rows. This module
 * applies the same rule to the parsed upload, and `pairScatterData` only
 * returns points when the reconstructed count equals the pair's reported n,
 * so a plot can never show rows other than those behind the coefficient.
 */

export interface ParsedDataset {
  headers: string[];
  /** Data rows below the header, in file order. */
  rows: unknown[][];
}

export interface PairPoint {
  /** 1-based data row (row 1 is the first row below the header). */
  dataRow: number;
  x: number;
  y: number;
}

export type PairScatterData =
  | { status: "ok"; points: PairPoint[] }
  | { status: "unavailable"; reason: string };

/** Finite number as pandas.to_numeric would read it, otherwise null. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value == null) return null;
  const text = String(value).trim();
  // Only plain decimal / exponent notation; hex, thousands separators etc. are
  // not numbers to pandas and so are missing here too.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function pairCompleteRows(dataset: ParsedDataset, xName: string, yName: string): PairPoint[] | null {
  const xi = dataset.headers.indexOf(xName);
  const yi = dataset.headers.indexOf(yName);
  if (xi < 0 || yi < 0) return null;
  if (dataset.headers.lastIndexOf(xName) !== xi || dataset.headers.lastIndexOf(yName) !== yi) return null;
  const points: PairPoint[] = [];
  dataset.rows.forEach((row, index) => {
    if (!Array.isArray(row)) return;
    const x = toFiniteNumber(row[xi]);
    const y = toFiniteNumber(row[yi]);
    if (x !== null && y !== null) points.push({ dataRow: index + 1, x, y });
  });
  return points;
}

export function pairScatterData(
  dataset: ParsedDataset | null | undefined,
  xName: string,
  yName: string,
  expectedN: number | null | undefined,
): PairScatterData {
  if (!dataset) return { status: "unavailable", reason: "The uploaded data are no longer available on this page." };
  const points = pairCompleteRows(dataset, xName, yName);
  if (!points) return { status: "unavailable", reason: "The variables could not be matched to single columns in the uploaded file." };
  if (expectedN == null || points.length !== expectedN) {
    return {
      status: "unavailable",
      reason:
        `The page could not reproduce exactly the ${expectedN ?? "reported"} complete rows used for this coefficient ` +
        `(found ${points.length}), so the scatterplot is not shown rather than risk plotting different rows.`,
    };
  }
  return { status: "ok", points };
}
