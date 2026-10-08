/**
 * Safe rendering of the optional per-result counts.
 *
 * `n_genotypes` and `n_reps` are `Optional[int]` on the backend. A generic
 * split-plot run has no single "treatment" factor, so the engine returns null
 * for n_genotypes — `String(r.n_genotypes)` printed "undefined" and
 * `?? 0` printed "0 treatment levels", both of which state something false
 * about the design. A count that does not exist is omitted instead.
 */

import type { GeneticsResult } from "@/services/geneticsUploadApi";
import { pl } from "@/lib/utils";

export function hasCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** One-line scale summary, listing only the counts the result actually has. */
export function describeResultScale(result: GeneticsResult): string {
  const parts: string[] = [
    `Grand mean: ${hasCount(result.grand_mean) ? result.grand_mean.toFixed(2) : "—"}`,
  ];
  const scale: string[] = [];
  if (hasCount(result.n_genotypes)) scale.push(pl(result.n_genotypes, "treatment level"));
  if (hasCount(result.n_reps)) scale.push(pl(result.n_reps, "replication"));
  if (scale.length > 0) parts.push(scale.join(" × "));
  return parts.join(" | ");
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function analysedValues(result: GeneticsResult): number[] {
  return (result.diagnostic_observations ?? [])
    .map((row) => finiteNumber(row.observed))
    .filter((value): value is number => value !== null);
}

function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const ss = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(ss / (values.length - 1));
}

/** Descriptive rows for AcademicResultsPanel, using fitted observations only. */
export function buildDescriptiveStats(
  result: GeneticsResult
): { label: string; value: string }[] {
  const ds = result.descriptive_stats ?? {};
  const values = analysedValues(result);
  const accountingN = finiteNumber(result.observation_accounting?.effective_n);

  const n = finiteNumber(ds.n) ?? accountingN ?? (values.length > 0 ? values.length : null);
  const mean =
    finiteNumber(ds.grand_mean) ??
    finiteNumber(result.grand_mean) ??
    (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const sd = finiteNumber(ds.standard_deviation) ?? sampleSd(values);
  const se =
    finiteNumber(ds.standard_error) ??
    (sd !== null && n !== null && n > 0 ? sd / Math.sqrt(n) : null);
  const minimum =
    finiteNumber(ds.min) ?? (values.length > 0 ? Math.min(...values) : null);
  const maximum =
    finiteNumber(ds.max) ?? (values.length > 0 ? Math.max(...values) : null);
  const descriptiveCv =
    finiteNumber(ds.cv_percent) ??
    (sd !== null && mean !== null && mean !== 0 ? (sd / Math.abs(mean)) * 100 : null);

  const rows: { label: string; value: string }[] = [];
  if (n !== null) rows.push({ label: "N", value: String(Math.trunc(n)) });
  rows.push({ label: "Mean", value: mean !== null ? mean.toFixed(4) : "—" });
  rows.push({ label: "SD", value: sd !== null ? sd.toFixed(4) : "—" });
  rows.push({ label: "SE", value: se !== null ? se.toFixed(4) : "—" });
  rows.push({ label: "Minimum", value: minimum !== null ? minimum.toFixed(4) : "—" });
  rows.push({ label: "Maximum", value: maximum !== null ? maximum.toFixed(4) : "—" });
  rows.push({
    label: "Descriptive CV (%)",
    value: descriptiveCv !== null ? descriptiveCv.toFixed(2) : "—",
  });

  // Keep structural context visible, but do not treat it as a substitute for
  // descriptive statistics.
  if (hasCount(result.n_genotypes)) {
    rows.push({ label: "Treatment Levels", value: String(result.n_genotypes) });
  }
  if (hasCount(result.n_reps)) {
    rows.push({ label: "Replications", value: String(result.n_reps) });
  }
  return rows;
}

