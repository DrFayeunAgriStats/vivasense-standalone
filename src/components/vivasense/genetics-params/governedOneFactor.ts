/**
 * Governed CRD / RCBD v1 presentation logic.
 *
 * Every statement produced here is DERIVED FROM THE BACKEND DECISION OBJECTS.
 * Nothing recomputes significance from the ANOVA table, and nothing compares a
 * p-value to a hardcoded 0.05 — that was the FB-1 defect, where a report
 * asserted significance at 0.05 while the analysis had been run at a different
 * selected alpha.
 *
 * Kept as pure functions so the wording can be tested without mounting React.
 */

import type {
  GeneticsResult,
  GovernedDecision,
  MeanSeparationStatus,
  TreatmentDecision,
  UploadAnalysisResponse,
} from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "./anovaDesigns";

/**
 * Diagnostic reference alpha.
 *
 * FIXED at 0.05 and deliberately a constant rather than anything read from the
 * request: assumption diagnostics must never inherit the user's selected
 * inferential alpha. Choosing α = 0.10 for treatment inference does not make a
 * normality test more willing to flag a departure.
 */
export const DIAGNOSTIC_ALPHA = 0.05;

/** Designs Phase C renders governance for. Factorial/split-plot are later phases. */
export const ONE_FACTOR_DESIGNS: GovernedDesignType[] = ["crd", "rcbd"];

export function isOneFactorDesign(design: GovernedDesignType): boolean {
  return ONE_FACTOR_DESIGNS.includes(design);
}

/**
 * A result is treated as GOVERNED only when the backend actually sent the
 * decision object. Older results render through the legacy path instead — they
 * must never be relabelled "governed" just because the client can now type the
 * fields.
 */
export function isGovernedOneFactor(
  result: GeneticsResult | null | undefined,
  design: GovernedDesignType
): boolean {
  if (!result) return false;
  if (!isOneFactorDesign(design)) return false;
  const decision = result.treatment_decision;
  return !!decision && typeof decision.significant === "boolean";
}

// ── Omnibus decision ─────────────────────────────────────────────────────────

export interface OmnibusDisplay {
  significant: boolean;
  estimable: boolean;
  pValue: number | null;
  alpha: number;
  /** "p = 0.0390" or "p < 0.001" */
  pText: string;
  /** Conservative one-line conclusion naming the alpha it was taken at. */
  sentence: string;
  /** The rule applied, stated so the reader can check it. */
  rule: string;
}

export function formatP(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(4)}`;
}

export function formatAlpha(alpha: number | null | undefined): string {
  return typeof alpha === "number" ? alpha.toFixed(2) : "—";
}

/**
 * Describe the omnibus treatment decision.
 *
 * The wording deliberately names the alpha in the same sentence as the verdict
 * ("not significant at α = 0.01"), because a bare "not significant" invites the
 * reader to supply 0.05 from habit.
 */
export function describeOmnibus(
  decision: TreatmentDecision | GovernedDecision | null | undefined,
  factorLabel = "treatment"
): OmnibusDisplay | null {
  if (!decision) return null;
  const alpha = typeof decision.alpha === "number" ? decision.alpha : DIAGNOSTIC_ALPHA;
  const significant = decision.significant === true;
  const estimable = decision.estimable !== false;
  const pValue = typeof decision.p_value === "number" ? decision.p_value : null;
  const pText = formatP(pValue);

  const sentence = !estimable
    ? `The ${factorLabel} effect could not be estimated from this design.`
    : `The ${factorLabel} effect was ${significant ? "significant" : "not significant"} at α = ${formatAlpha(alpha)} (${pText}).`;

  return {
    significant,
    estimable,
    pValue,
    alpha,
    pText,
    sentence,
    rule: `Decision rule: significant when p ≤ α (α = ${formatAlpha(alpha)}).`,
  };
}

// ── Mean-separation gate ─────────────────────────────────────────────────────

export type SeparationTone = "success" | "withheld" | "not_estimable" | "failed" | "unknown";

export interface SeparationDisplay {
  tone: SeparationTone;
  heading: string;
  detail: string;
  method: string | null;
  alpha: number | null;
  /** True only when grouping letters should be shown. */
  showLetters: boolean;
}

/**
 * Explain why mean separation did or did not produce grouping letters.
 *
 * A withheld post-hoc is a governed OUTCOME, not missing output: under a
 * protected procedure the omnibus gate is what makes the family-wise error rate
 * meaningful. The wording therefore says the step was deliberately not run,
 * never that results are unavailable.
 */
export function describeSeparationGate(
  status: MeanSeparationStatus | null | undefined,
  hasLetters: boolean
): SeparationDisplay | null {
  if (!status) {
    // Legacy result: letters may exist with no status object.
    return hasLetters
      ? {
          tone: "unknown",
          heading: "Mean separation",
          detail: "Grouping letters were returned by the analysis.",
          method: null,
          alpha: null,
          showLetters: true,
        }
      : null;
  }

  const method = typeof status.method === "string" ? status.method : null;
  const alpha = typeof status.alpha === "number" ? status.alpha : null;
  const alphaText = alpha === null ? "the selected α" : `α = ${formatAlpha(alpha)}`;
  const raw = String(status.status ?? "").toLowerCase();

  if (raw === "success") {
    return {
      tone: "success",
      heading: "Mean separation performed",
      detail: `The omnibus effect met ${alphaText}, so ${method ?? "mean separation"} was carried out.`,
      method,
      alpha,
      showLetters: true,
    };
  }

  if (raw === "not_run_omnibus_not_significant") {
    return {
      tone: "withheld",
      heading: "Mean separation withheld",
      detail:
        `The omnibus effect did not meet ${alphaText}, so ${method ?? "mean separation"} was deliberately not run. ` +
        "This is the protected procedure working as intended — comparing means after a non-significant omnibus test would not control the error rate. It does not mean results are missing.",
      method,
      alpha,
      showLetters: false,
    };
  }

  if (raw === "not_estimable") {
    return {
      tone: "not_estimable",
      heading: "Mean separation not estimable",
      detail:
        (typeof status.message === "string" && status.message) ||
        "The comparison could not be estimated from this design and data.",
      method,
      alpha,
      showLetters: false,
    };
  }

  if (raw === "failed") {
    return {
      tone: "failed",
      heading: "Mean separation step failed",
      detail:
        ((typeof status.message === "string" && status.message) ||
          "The mean-separation step did not complete.") +
        " The ANOVA itself completed — only this post-hoc step failed.",
      method,
      alpha,
      showLetters: false,
    };
  }

  return {
    tone: "unknown",
    heading: "Mean separation",
    detail: (typeof status.message === "string" && status.message) || `Status: ${status.status}`,
    method,
    alpha,
    showLetters: hasLetters,
  };
}

// ── Observation accounting ───────────────────────────────────────────────────

export interface AccountingRow {
  label: string;
  value: string;
}

const ACCOUNTING_LABELS: [string, string][] = [
  ["uploaded_rows", "Rows uploaded"],
  ["available_rows", "Rows available"],
  ["analysed_rows", "Rows analysed"],
  ["analyzed_rows", "Rows analysed"],
  ["excluded_rows", "Rows excluded"],
  ["missing_response_rows", "Rows with no response value"],
  ["experimental_units", "Experimental units"],
  ["n_observations", "Observations analysed"],
  ["effective_n", "Effective observations"],
];

/**
 * Turn observation accounting into display rows.
 *
 * Terminology stays domain-neutral: rows and observations are counted, never
 * called "genotypes". The mapped treatment column is frequently a fertiliser
 * rate or a spray regime, and calling those genotypes is simply wrong.
 */
export function describeObservationAccounting(
  accounting: Record<string, unknown> | null | undefined
): AccountingRow[] {
  if (!accounting) return [];
  const rows: AccountingRow[] = [];
  const seen = new Set<string>();
  for (const [key, label] of ACCOUNTING_LABELS) {
    if (seen.has(label)) continue;
    const value = accounting[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      rows.push({ label, value: String(value) });
      seen.add(label);
    }
  }
  return rows;
}

// ── Design summary ───────────────────────────────────────────────────────────

export interface DesignSummaryRow {
  label: string;
  value: string;
  /** Extra clarification shown under the value. */
  note?: string;
}

/**
 * Compact design summary for a governed CRD / RCBD result.
 *
 * The RCBD block row carries an explicit note that replication is design
 * structure rather than a treatment effect — a block line in an ANOVA table is
 * routinely misread as a fourth treatment being compared.
 */
export function buildDesignSummary(
  design: GovernedDesignType,
  result: GeneticsResult,
  mapping: { treatment?: string; rep?: string },
  alpha: number
): DesignSummaryRow[] {
  const rows: DesignSummaryRow[] = [
    {
      label: "Design",
      value:
        design === "crd"
          ? "Completely Randomized Design (CRD)"
          : "Randomized Complete Block Design (RCBD)",
    },
  ];

  if (mapping.treatment) {
    rows.push({ label: "Treatment / factor", value: mapping.treatment });
  }
  if (typeof result.n_genotypes === "number") {
    rows.push({ label: "Treatment levels", value: String(result.n_genotypes) });
  }

  if (design === "rcbd") {
    if (mapping.rep) {
      rows.push({
        label: "Replication / block factor",
        value: mapping.rep,
        note: "Part of the design structure — blocks account for background variation and are not a treatment being compared.",
      });
    }
    if (typeof result.n_reps === "number") {
      rows.push({ label: "Blocks", value: String(result.n_reps) });
    }
  } else if (typeof result.n_reps === "number") {
    rows.push({
      label: "Replicates per treatment",
      value: String(result.n_reps),
      note: "Independent experimental units — CRD has no blocking term.",
    });
  }

  const accounting = describeObservationAccounting(result.observation_accounting);
  const analysed = accounting.find((r) => r.label === "Rows analysed" || r.label === "Observations analysed");
  if (analysed) {
    rows.push({ label: "Observations analysed", value: analysed.value });
  }

  rows.push({ label: "Inferential α", value: formatAlpha(alpha) });
  return rows;
}

// ── Diagnostics governance ───────────────────────────────────────────────────

export interface DiagnosticsPolicyDisplay {
  diagnosticAlpha: number;
  inferentialAlpha: number;
  /** True when the backend sent an explicit governed policy. */
  governed: boolean;
  statements: string[];
}

/**
 * Governed diagnostics framing.
 *
 * Returns evidence-language statements only. Nothing here certifies a model,
 * and the diagnostic alpha is always DIAGNOSTIC_ALPHA regardless of what the
 * user selected for inference.
 */
export function describeDiagnosticsPolicy(
  result: GeneticsResult | null | undefined,
  inferentialAlpha: number
): DiagnosticsPolicyDisplay {
  // An EMPTY object does not count as a governed policy. jsonlite serialises an
  // R NULL as `{}`, so `!!policy` would report governance for a field the engine
  // never populated — the same `{}` hazard that once made every one-factor
  // result look factorial in the backend.
  const policy = result?.diagnostic_policy;
  const governed =
    !!policy && typeof policy === "object" && Object.keys(policy).length > 0;
  return {
    diagnosticAlpha: DIAGNOSTIC_ALPHA,
    inferentialAlpha,
    governed,
    statements: [
      `Assumption diagnostics are evaluated at a fixed reference α = ${formatAlpha(DIAGNOSTIC_ALPHA)}, independent of the inferential α = ${formatAlpha(inferentialAlpha)} selected for treatment decisions.`,
      "Residual-versus-fitted patterns are evidence about variance behaviour across the fitted range.",
      "The Q-Q plot is the primary graphical evidence about the normality of residuals; the Shapiro-Wilk test is supplementary and is sensitive to sample size.",
      "Influence measures such as Cook's distance flag observations worth inspecting; they are evidence, not grounds for removal.",
      "Independence follows from how the experiment was randomised and cannot be established from residuals alone.",
      "No observation is deleted and no transformation is applied automatically. Diagnostics should be considered with the design context.",
    ],
  };
}

// ── Export routing ───────────────────────────────────────────────────────────

export type ExportRoute = "governed" | "legacy";

/**
 * Choose the export path.
 *
 * The governed export requires the exact `export_token` the backend issued.
 * The frontend must never generate, replace or repair that token: it is the
 * backend's handle on the stored analysis, and inventing one would either fail
 * or, worse, address a different analysis. A result without a token uses the
 * legacy path rather than a fabricated governed one.
 */
export function chooseExportRoute(response: UploadAnalysisResponse | null | undefined): ExportRoute {
  const token = response?.export_token;
  return typeof token === "string" && token.length > 0 ? "governed" : "legacy";
}

export const STALE_TOKEN_MESSAGE =
  "This report can no longer be generated because the original analysis identity is no longer " +
  "available for secure export. This usually happens after the analysis service restarts and its " +
  "in-memory analysis cache is cleared. Please rerun the analysis and download the report again — " +
  "no substitute report will be produced from another result.";

/**
 * Is this failure the backend refusing an exact-token export?
 *
 * The shared API client throws the backend's `detail` string rather than the
 * status code, so a 409 usually arrives as prose. Both signals are checked: a
 * numeric status when one is available, and the backend's own wording
 * otherwise.
 */
export function isStaleTokenFailure(status: number | null, message: string): boolean {
  if (status === 409) return true;
  return /no longer available for secure export/i.test(message);
}

/**
 * Message for a failed export.
 *
 * A stale exact token means the stored analysis behind it is gone. The only
 * correct response is to rerun: silently exporting some other cached result
 * would produce a document that does not belong to the analysis on screen,
 * which is precisely what exact-token identity exists to prevent.
 */
export function describeExportFailure(status: number | null, fallback?: string): string {
  const message = fallback ?? "";
  if (isStaleTokenFailure(status, message)) return STALE_TOKEN_MESSAGE;
  if (status === 403 || /pro|mode/i.test(message)) {
    return "Report export is not available in the current product mode.";
  }
  return message || "The report could not be generated. Please try again.";
}
