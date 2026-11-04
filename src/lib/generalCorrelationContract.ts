/**
 * REL-UI-01 Phase A (Option B) — General correlation request contract.
 *
 * POST /genetics/correlation/general accepts ordinary observed-variable
 * correlation only. The request has NO genotype, replication, environment,
 * design or analysis-context field; the backend rejects any such field.
 * Genetic analyses keep using the existing (unchanged) legacy pages.
 */

export const GENERAL_CORRELATION_ENDPOINT = "/genetics/correlation/general";

export type GeneralCorrelationMethod = "pearson" | "spearman";
export type GeneralCorrelationAlpha = 0.01 | 0.05 | 0.1;

/** Live catalogue (backend Literal[0.01, 0.05, 0.10]); no rounding. */
export const GENERAL_SUPPORTED_ALPHAS: readonly GeneralCorrelationAlpha[] = [0.01, 0.05, 0.1];

export interface GeneralCorrelationRequest {
  base64_content: string;
  file_type: "csv" | "xlsx" | "xls";
  trait_columns: string[];
  method: GeneralCorrelationMethod;
  alpha: GeneralCorrelationAlpha;
}

export interface BuildGeneralCorrelationRequestInput {
  base64Content: string;
  fileType: "csv" | "xlsx" | "xls";
  traitColumns: string[];
  method: GeneralCorrelationMethod;
  alpha?: GeneralCorrelationAlpha;
}

export function buildGeneralCorrelationRequest(
  input: BuildGeneralCorrelationRequestInput,
): GeneralCorrelationRequest {
  const traits = Array.from(new Set(input.traitColumns.map((t) => t.trim()).filter(Boolean)));
  if (traits.length < 2) throw new Error("Select at least two numeric variables.");
  if (input.method !== "pearson" && input.method !== "spearman") {
    throw new Error("Correlation method must be Pearson or Spearman.");
  }
  const alpha = input.alpha ?? 0.05;
  if (!GENERAL_SUPPORTED_ALPHAS.includes(alpha)) {
    throw new Error("Significance level must be 0.01, 0.05 or 0.10.");
  }
  if (!input.base64Content) throw new Error("Upload a dataset first.");
  return {
    base64_content: input.base64Content,
    file_type: input.fileType,
    trait_columns: traits,
    method: input.method,
    alpha,
  };
}
