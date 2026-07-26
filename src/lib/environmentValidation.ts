/**
 * Environment-column validation
 * =============================
 * A "multi-environment" genetics run is only statistically valid when the
 * environment column actually contains ≥2 distinct levels. With a single level
 * there are 0 degrees of freedom for an Environment main effect and no GxE term
 * is estimable — asking the backend to run multi-environment analysis on such a
 * dataset produces spurious Environment/GxE F-statistics and an unreliable
 * heritability denominator.
 *
 * These helpers let the frontend detect that condition BEFORE submission and
 * fall back to single-environment mode. They only influence request parameters
 * (mode / environment_column) — never any computed statistical field, which
 * remains the sole responsibility of the R engine backend.
 */

import * as XLSX from "xlsx";

/** Case-insensitive tokens treated as "missing" and excluded from the level count. */
const NA_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "--"]);

const isMissing = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  const s = String(value).trim();
  return s.length === 0 || NA_TOKENS.has(s.toLowerCase());
};

/**
 * Count the number of distinct non-missing values in a single column of an
 * uploaded CSV/Excel file. Reads the first sheet only, matching the rest of the
 * upload pipeline. Returns 0 if the column is absent or entirely missing.
 *
 * Throws if the file cannot be parsed — callers should decide whether to treat
 * a parse failure as "cannot confirm multi-environment" (safer: fall back to
 * single) or surface the error.
 */
export async function countDistinctColumnValues(
  file: File,
  columnName: string
): Promise<number> {
  const lowerName = file.name.toLowerCase();
  let workbook: XLSX.WorkBook;
  if (lowerName.endsWith(".csv")) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: "string" });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array" });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return 0;
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const seen = new Set<string>();
  for (const row of rows) {
    const raw = row[columnName];
    if (isMissing(raw)) continue;
    seen.add(String(raw).trim());
  }
  return seen.size;
}

/**
 * Decide whether a run may proceed as multi-environment.
 *
 * Returns the mode the run should actually use plus, when a downgrade happened,
 * a human-readable reason for warning the user. A file parse failure is treated
 * conservatively as "cannot confirm ≥2 environments" and downgrades to single.
 *
 * @param file            the uploaded dataset
 * @param environmentColumn  selected environment column, or null/"" if none
 * @param requestedMode   the mode the UI currently intends to send
 */
export async function resolveEnvironmentMode(
  file: File,
  environmentColumn: string | null | undefined,
  requestedMode: "single" | "multi"
): Promise<{ mode: "single" | "multi"; distinctCount: number; downgradeReason: string | null }> {
  const col = (environmentColumn ?? "").trim();

  // No environment column selected → single-environment, nothing to validate.
  if (!col) {
    return { mode: "single", distinctCount: 0, downgradeReason: null };
  }

  // Only multi runs need the ≥2-level guarantee.
  if (requestedMode !== "multi") {
    return { mode: "single", distinctCount: 0, downgradeReason: null };
  }

  let distinctCount: number;
  try {
    distinctCount = await countDistinctColumnValues(file, col);
  } catch {
    return {
      mode: "single",
      distinctCount: 0,
      downgradeReason:
        `Could not read the "${col}" column to confirm multiple environments; ` +
        `running single-environment analysis instead.`,
    };
  }

  if (distinctCount < 2) {
    return {
      mode: "single",
      distinctCount,
      downgradeReason:
        `The "${col}" column has only ${distinctCount === 1 ? "1 unique value" : "no usable values"}, ` +
        `so Environment and Genotype×Environment effects cannot be estimated. ` +
        `Running single-environment analysis instead.`,
    };
  }

  return { mode: "multi", distinctCount, downgradeReason: null };
}
