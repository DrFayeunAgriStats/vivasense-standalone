/**
 * Numeric formatting for Crop Protection results.
 *
 * Domain-neutral by design: nothing here refers to genotypes, entries or
 * environments. p-values are never printed as 0.0000 — below the display
 * resolution they are reported as "<0.001".
 */

export function fmt(value: unknown, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Significance stars follow the same convention as the ANOVA module. */
export function formatP(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n < 0.001) return "<0.001";
  return n.toFixed(4);
}

export function significanceStars(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n < 0.001) return "***";
  if (n < 0.01) return "**";
  if (n < 0.05) return "*";
  return "ns";
}

/** "96.67 ± 3.33 a" — the publication form for an interaction cell. */
export function meanSeLetter(mean: unknown, se: unknown, letter?: string | null): string {
  const base = `${fmt(mean)} ± ${fmt(se)}`;
  return letter ? `${base} ${letter}` : base;
}

export function fmtDose(dose: unknown): string {
  const n = Number(dose);
  if (!Number.isFinite(n)) return String(dose ?? "—");
  return String(n);
}

/** Human wording for the backend's co-toxicity inference vocabulary. */
export function cotoxicityInterpretation(
  inference: string | null,
  direction: string | null
): string {
  switch (inference) {
    case "supports_synergy_under_bliss":
      return "Supports synergy under Bliss independence";
    case "supports_antagonism_under_bliss":
      return "Supports antagonism under Bliss independence";
    case "ceiling_limited":
      return "Ceiling limited";
    case "not_distinguishable_from_additivity":
      if (direction === "positive_deviation") {
        return "Positive deviation — not distinguishable from additivity";
      }
      if (direction === "negative_deviation") {
        return "Negative deviation — not distinguishable from additivity";
      }
      return "Not distinguishable from additivity";
    default:
      return inference ? inference.replace(/_/g, " ") : "—";
  }
}

export function regressionInterpretation(row: {
  status: string;
  significance: string;
  direction: string;
}): string {
  if (row.status === "insufficient_dose_variation") return "Insufficient dose variation";
  if (row.status === "constant_response" || row.direction === "constant") return "No variation";
  if (row.significance === "significant" && row.direction === "increasing") {
    return "Significant increasing trend";
  }
  if (row.significance === "significant" && row.direction === "decreasing") {
    return "Significant decreasing trend";
  }
  return "No significant linear trend";
}
