import type { AnovaTable } from "@/services/geneticsUploadApi";

/** Display-only experimental residual CV; never substitutes descriptive sample CV. */
export function experimentalResidualCV(
  design: string | null | undefined,
  table: AnovaTable | null | undefined,
  grandMean: number | null | undefined
): number | null {
  if (design !== "crd" && design !== "rcbd") return null;
  if (!table || !Array.isArray(table.source) || !Array.isArray(table.ms)
      || typeof grandMean !== "number" || !Number.isFinite(grandMean) || grandMean <= 0) return null;
  const errors = table.source.map((name, i) => ({ name: name.trim().toLowerCase(), i }))
    .filter(({ name }) => /^(error|residuals?)(?:\s*\([^)]*\))?$/.test(name));
  if (errors.length !== 1) return null;
  const mse = table.ms[errors[0].i];
  if (typeof mse !== "number" || !Number.isFinite(mse) || mse < 0) return null;
  return Math.sqrt(mse) / grandMean * 100;
}
