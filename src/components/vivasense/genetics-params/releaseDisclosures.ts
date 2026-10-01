/**
 * OCT1 release-boundary disclosures shared by the governed ANOVA UI.
 *
 * These helpers do not perform statistical inference. They keep the interface
 * aligned with backend release limitations and fail-safe presentation rules.
 */

import type { GovernedDesignType } from "./anovaDesigns";

export const SESSION_ONLY_PREVIEW_WARNING =
  "Preview: This analysis is session-only. The full analysis result cannot currently be reopened after the session ends. Download the Word report now if you need to retain the output.";

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

/**
 * True for any backend or frontend form of the session-only Preview warning.
 * The backend sends its own wording through `data_warnings`; the panel already
 * shows the disclosure once, so every variant is recognised by its fixed lead.
 */
export function isSessionOnlyPreviewWarning(text: string): boolean {
  return text.trim().toLowerCase().startsWith("preview: this analysis is session-only");
}

/** Absolute tolerance for comparing the selected alpha with the payload alpha. */
const ALPHA_TOLERANCE = 1e-9;

/**
 * Payload-consistency guard for all-cell factorial Tukey letters.
 *
 * R-SIGNOFF-01: the backend computes all-cell groupings at the selected alpha
 * (0.01, 0.05 and 0.10), so letters are hidden only when the payload does not
 * state the alpha it was computed at, or states one that differs from the
 * selected inferential alpha.
 */
export function shouldHideFactorialAllCellGroups(
  selectedAlpha: number,
  payloadAlpha: number | null
): boolean {
  if (payloadAlpha === null || !Number.isFinite(payloadAlpha)) return true;
  return Math.abs(payloadAlpha - selectedAlpha) > ALPHA_TOLERANCE;
}

export function factorialAllCellAlphaWarning(
  selectedAlpha: number,
  payloadAlpha: number | null
): string {
  const reason =
    payloadAlpha === null || !Number.isFinite(payloadAlpha)
      ? "the result does not state the alpha they were computed at"
      : `they were computed at alpha ${payloadAlpha.toFixed(2)}, not the selected ` +
        `inferential alpha ${selectedAlpha.toFixed(2)}`;
  return (
    `All-cell factorial Tukey grouping letters are hidden because ${reason}. ` +
    "Treatment-combination means remain available as descriptive values; " +
    "use the governed marginal and simple-effects results for inference."
  );
}
