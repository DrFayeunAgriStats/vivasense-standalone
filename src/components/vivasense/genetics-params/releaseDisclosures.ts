/**
 * OCT1 release-boundary disclosures shared by the governed ANOVA UI.
 *
 * These helpers do not perform statistical inference. They keep the interface
 * aligned with backend release limitations and fail-safe presentation rules.
 */

import type { GovernedDesignType } from "./anovaDesigns";

export const SESSION_ONLY_PREVIEW_WARNING =
  "Preview: this analysis is session-only. The full analysis result cannot currently be reopened after the session ends. Download the Word report now if you need to retain the output.";

export function isSessionOnlyPreviewDesign(
  design: GovernedDesignType | "factorial" | string | null | undefined
): boolean {
  return (
    design === "factorial" ||
    design === "factorial_crd" ||
    design === "factorial_rcbd" ||
    design === "split_plot_rcbd"
  );
}

export function factorialAllCellAlphaWarning(alpha: number): string {
  return (
    "All-cell factorial Tukey grouping letters are hidden because the selected " +
    `inferential alpha is ${alpha.toFixed(2)}, not 0.05. ` +
    "Treatment-combination means remain available as descriptive values; " +
    "use the governed marginal and simple-effects results for inference."
  );
}

export function shouldHideFactorialAllCellGroups(alpha: number): boolean {
  return Math.abs(alpha - 0.05) > 1e-12;
}
