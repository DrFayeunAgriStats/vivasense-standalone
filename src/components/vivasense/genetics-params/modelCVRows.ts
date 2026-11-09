import type { GeneticsResult } from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "./anovaDesigns";

export interface ModelCVRow {
  label: string;
  percent: number;
  provenance: string;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Describe exactly the residual stratum(s) used in the backend's existing CV.
 * This is presentation-only; no F tests, inferential decisions or model fits
 * are made in the browser.
 */
export function modelCVRows(
  result: GeneticsResult,
  design: GovernedDesignType,
  mode: string,
): ModelCVRow[] {
  if (design === "split_plot_rcbd") {
    const a = result.variance_components?.cv_A;
    const b = result.variance_components?.cv_B;
    const rows: ModelCVRow[] = [];
    if (finite(a) && a >= 0) rows.push({label: "CV(A) · whole-plot", percent: a, provenance: "Whole-plot error (Error A)"});
    if (finite(b) && b >= 0) rows.push({label: "CV(B) · subplot", percent: b, provenance: "Subplot error (Error B)"});
    return rows;
  }
  if (design !== "factorial_crd" && design !== "factorial_rcbd" && mode !== "multi") return [];
  const at = result.anova_table;
  const grandMean = result.grand_mean;
  if (!at || !finite(grandMean) || grandMean === 0) return [];
  const idx = at.source.findIndex(name => ["Residuals", "Residual", "Error"].includes(name));
  if (idx < 0) return [];
  const errorMs = at.ms[idx];
  if (!finite(errorMs) || errorMs < 0) return [];
  const cv = Math.sqrt(errorMs) / Math.abs(grandMean) * 100;
  return finite(cv) ? [{
    label: mode === "multi" ? "Residual CV (%) · combined" : "Residual CV (%)",
    percent: cv,
    provenance: "Root mean square residual error divided by absolute grand mean",
  }] : [];
}
