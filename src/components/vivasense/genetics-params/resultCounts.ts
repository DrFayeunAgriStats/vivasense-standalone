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
  const isMulti = result.environment_mode === "multi_environment" && hasCount(result.n_environments) && result.n_environments > 1;
  if (hasCount(result.n_genotypes)) scale.push(pl(result.n_genotypes, isMulti ? "genotype" : "treatment level"));
  if (isMulti && hasCount(result.n_environments)) scale.push(pl(result.n_environments, "environment"));
  if (hasCount(result.n_reps)) scale.push(isMulti
    ? pl(result.n_reps, "block per environment", "blocks per environment")
    : pl(result.n_reps, "replication"));
  if (scale.length > 0) parts.push(scale.join(" × "));
  return parts.join(" | ");
}

/** Descriptive rows for AcademicResultsPanel, omitting counts the design lacks. */
export function buildDescriptiveStats(
  result: GeneticsResult
): { label: string; value: string }[] {
  const rows = [
    { label: "Grand Mean", value: hasCount(result.grand_mean) ? result.grand_mean.toFixed(4) : "—" },
  ];
  if (hasCount(result.n_genotypes)) {
    rows.push({ label: "Treatment Levels", value: String(result.n_genotypes) });
  }
  if (hasCount(result.n_reps)) {
    rows.push({ label: "Replications", value: String(result.n_reps) });
  }
  return rows;
}
