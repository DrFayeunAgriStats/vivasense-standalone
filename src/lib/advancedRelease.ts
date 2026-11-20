/** Production-only Advanced Analytics beta release control.
 * Disabled until the pinned production R backend, typed API contracts, and
 * live browser checks have been verified. Never use client visibility as a
 * substitute for backend authorization or scientific validation.
 */
export const advancedBetaEnabled = import.meta.env.VITE_ADVANCED_BETA_PRODUCTION === "true";

export const advancedBetaNotice =
  "Experimental beta: scientific validation is in progress. Results are exploratory, not approved for confirmatory research, publication claims, or genotype-selection decisions. Verify against independent reference calculations.";

/** Exact banner required on every Advanced Analytics screen while scientific validation is in progress. */
export const advancedBetaBanner = "Experimental Beta — Scientific Validation in Progress.";
