/**
 * Governed RCBD transformation workflow — exploration → explicit selection.
 *
 * The controlling idea is that exploring a transformation and adopting it are
 * different acts. Exploration is exploratory by contract: the backend stamps
 * every exploration `authority: "exploratory_not_selected_for_inference"`, and
 * the raw analysis stays authoritative until a person deliberately says
 * otherwise. Nothing here transforms anything automatically, and nothing
 * reconstructs a transformed branch client-side.
 */

import type { AnovaAlpha, GeneticsResult, UploadAnalysisResponse } from "@/services/geneticsUploadApi";
import type {
  ExplorationRequest,
  ExplorationResponse,
  ResponseMetadata,
  SelectTransformedAnalysisRequest,
  SelectedTransformedAnalysis,
} from "@/services/rcbdTransformationApi";
import type { GovernedDesignType } from "./anovaDesigns";

export const SELECTION_ACTION =
  "Use this transformed analysis for inferential reporting" as const;

/** Response semantic classes the backend recognises. */
export type ResponseType = ResponseMetadata["response_type"];

/**
 * Box-Cox assumes a continuous positive response. For counts, proportions,
 * binomial outcomes and ratings there are purpose-built model families, and
 * presenting Box-Cox as the general remedy would misrepresent it. v1 governs
 * exact Box-Cox exploration only, so those classes are offered the exploration
 * with an explicit caution rather than silently treated as equivalent.
 */
export const NON_CONTINUOUS_TYPES: ResponseType[] = [
  "count",
  "proportion_percentage",
  "binary_binomial",
  "rating_index",
];

export function isContinuousSemantics(type: ResponseType | undefined): boolean {
  return type === "continuous";
}

export function semanticsCaution(type: ResponseType | undefined): string | null {
  if (!type || type === "continuous" || type === "unknown") return null;
  const label: Record<string, string> = {
    count: "a count",
    proportion_percentage: "a proportion or percentage",
    binary_binomial: "a binary or binomial outcome",
    rating_index: "a rating or index",
  };
  return (
    `This response is declared as ${label[type] ?? type}. Box-Cox is defined for a continuous ` +
    "positive response; for this kind of response a purpose-built model family is usually more " +
    "appropriate than a power transformation. Split-Plot v1 governs exact Box-Cox exploration only, " +
    "so treat any result here as exploratory context rather than a recommended remedy."
  );
}

// ── Eligibility ──────────────────────────────────────────────────────────────

export interface ExplorationEligibility {
  available: boolean;
  reason: string | null;
}

/**
 * Whether governed exploration may be offered for a trait.
 *
 * Client-side checks are limited to what the client actually knows: the design,
 * that the trait succeeded, and that a raw analysis identity exists. Everything
 * scientific — whether the response supports Box-Cox, whether the optimum is
 * usable — is the backend's call, reported back as eligibility metadata.
 */
export function explorationEligibility(
  design: GovernedDesignType,
  result: GeneticsResult | null | undefined,
  traitStatus: string,
  rawAnalysisToken: string | null | undefined
): ExplorationEligibility {
  if (design !== "rcbd") {
    return { available: false, reason: "Governed transformation exploration is available for complete one-factor RCBD only." };
  }
  if (traitStatus !== "success" || !result) {
    return { available: false, reason: "The raw analysis for this response variable did not complete." };
  }
  if (!result.treatment_decision) {
    return { available: false, reason: "This result predates the governed analysis contract, so its identity cannot be carried into a transformation branch." };
  }
  if (!rawAnalysisToken) {
    return { available: false, reason: "The exact raw-analysis identity is unavailable, so a transformation branch cannot be tied to it." };
  }
  return { available: true, reason: null };
}

// ── Request construction ─────────────────────────────────────────────────────

export function buildExplorationRequest(input: {
  rawAnalysisToken: string;
  trait: string;
  alpha: AnovaAlpha;
  responseType?: ResponseType;
}): ExplorationRequest {
  return {
    analysis_token: input.rawAnalysisToken,
    trait: input.trait,
    // The backend rejects anything but true — exploration is never implicit.
    user_initiated: true,
    inferential_alpha: input.alpha,
    // Must contain exactly the requested trait.
    response_metadata: {
      [input.trait]: {
        response_type: input.responseType ?? "continuous",
        unit: null,
        declared_scale: null,
        numerator_column: null,
        denominator_column: null,
      },
    },
  };
}

export function buildSelectionRequest(
  exploration: ExplorationResponse,
  acknowledgement?: string | null
): SelectTransformedAnalysisRequest {
  const request: SelectTransformedAnalysisRequest = {
    raw_analysis_token: exploration.raw_analysis_token,
    transformed_branch_token: exploration.transformed_branch_token,
    trait: exploration.trait,
    inferential_alpha: exploration.inferential_alpha,
    // The exact frame the user reviewed — never re-derived.
    model_frame_identity: exploration.model_frame_identity,
    user_selected: true,
    selection_action: SELECTION_ACTION,
  };
  if (acknowledgement) {
    request.diagnostic_concern_acknowledged = true;
    request.diagnostic_concern_acknowledgement = acknowledgement;
  }
  return request;
}

// ── Box-Cox display ──────────────────────────────────────────────────────────

export interface LambdaDisplay {
  /** λ at full precision — 0.15 must not be mistaken for 0. */
  lambdaText: string;
  lambda: number | null;
  transform: string | null;
  formula: string | null;
  inverseFormula: string | null;
  shift: number | null;
  searchRange: string | null;
  profileInterval: string | null;
  confidenceLevel: number | null;
  exactness: string | null;
  warnings: string[];
  boundaryHit: boolean;
  intervalTruncated: boolean;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Read a list that R may have delivered as a bare string.
 *
 * jsonlite unboxes a length-1 character vector, so a single warning or a single
 * eligibility reason arrives as `"..."` rather than `["..."]`. Treating that as
 * "not an array" silently dropped it; calling `.map` on it threw
 * "reasons.map is not a function" and took the whole panel down. Spreading the
 * string would be worse still — it would yield one entry per character.
 */
function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.length > 0 ? [v] : [];
  return [];
}

/**
 * Present the candidate exactly as the engine reported it.
 *
 * λ is shown to four decimals rather than rounded to a "nice" value: λ = 0.15
 * and λ = 0 are different transformations, and collapsing them would hide that.
 * The transform is named only as the backend names it — a λ of exactly 0 is
 * reported as a log transform because the engine's own formula says
 * `log(x + 0)`, not because the client decided to relabel it.
 */
export function readLambda(candidate: Record<string, unknown> | null | undefined): LambdaDisplay | null {
  if (!candidate || typeof candidate !== "object") return null;
  const profile = (candidate.lambda_profile ?? {}) as Record<string, unknown>;
  const lambda = asNumber(candidate.lambda);
  const min = asNumber(profile.search_minimum);
  const max = asNumber(profile.search_maximum);
  const increment = asNumber(profile.increment);
  const interval = Array.isArray(profile.profile_interval)
    ? (profile.profile_interval as unknown[]).map(asNumber)
    : [];

  return {
    lambda,
    lambdaText: lambda === null ? "—" : lambda.toFixed(4),
    transform: typeof candidate.transform === "string" ? candidate.transform : null,
    formula: typeof candidate.formula === "string" ? candidate.formula : null,
    inverseFormula: typeof candidate.inverse_formula === "string" ? candidate.inverse_formula : null,
    shift: asNumber(candidate.shift),
    searchRange:
      min !== null && max !== null
        ? `${min.toFixed(2)} to ${max.toFixed(2)}${increment !== null ? ` (step ${increment})` : ""}`
        : null,
    profileInterval:
      interval.length === 2 && interval[0] !== null && interval[1] !== null
        ? `${interval[0].toFixed(4)} to ${interval[1].toFixed(4)}`
        : null,
    confidenceLevel: asNumber(profile.confidence_level),
    exactness: typeof profile.exact_vs_approximation === "string" ? profile.exact_vs_approximation : null,
    warnings: asStringList(candidate.warnings),
    boundaryHit: profile.boundary_hit === true,
    intervalTruncated: profile.interval_truncated === true,
  };
}

// ── Eligibility / boundary governance ────────────────────────────────────────

export interface SelectionGate {
  selectable: boolean;
  status: string;
  reasons: string[];
  /** Prominent explanation shown when selection is blocked. */
  blockedExplanation: string | null;
}

const REASON_TEXT: Record<string, string> = {
  lambda_optimum_on_search_boundary:
    "The Box-Cox optimum sits at the edge of the evaluated grid, so the true optimum may lie outside it.",
  profile_interval_truncated:
    "The profile confidence interval is cut off by the edge of the evaluated grid, so the uncertainty in λ is not fully characterised.",
};

/**
 * Whether the explored branch may be adopted for inference.
 *
 * The backend's eligibility verdict is final. A boundary optimum means the
 * evidence does not identify a stable λ, and selecting on that basis would give
 * an arbitrary transformation the standing of a governed inferential choice —
 * so the block is surfaced, never overridden.
 */
export function readSelectionGate(exploration: ExplorationResponse | null | undefined): SelectionGate {
  if (!exploration) {
    return { selectable: false, status: "none", reasons: [], blockedExplanation: null };
  }
  const status = exploration.eligibility_status;
  const reasons = asStringList(exploration.eligibility_reasons);
  const selectable = status === "eligible_for_future_selection";
  return {
    selectable,
    status,
    reasons,
    blockedExplanation: selectable
      ? null
      : "This exploration is not a stable basis for governed selection, so it cannot be adopted for " +
        "inferential reporting. The raw analysis remains authoritative." +
        (reasons.length
          ? " " + reasons.map((r) => REASON_TEXT[r] ?? r).join(" ")
          : ""),
  };
}

// ── Diagnostics wording ──────────────────────────────────────────────────────

export const TRANSFORMED_DIAGNOSTICS_NOTE =
  "The transformed model changes the diagnostic evidence, but this does not by itself prove that the " +
  "transformed analysis is preferable. Diagnostics are evidence to weigh alongside the design and the " +
  "meaning of the response — not a test the analysis passes or fails.";

export const SELECTION_MEANING_NOTE =
  "Selecting the transformed analysis records which model carries inferential authority. It does not " +
  "assert that the model assumptions have been resolved.";

// ── Authority state ──────────────────────────────────────────────────────────

export type AuthorityState = "raw_primary" | "explored_not_selected" | "transformed_selected";

export function authorityLabel(state: AuthorityState): string {
  switch (state) {
    case "raw_primary":
      return "Raw analysis — primary";
    case "explored_not_selected":
      return "Transformation explored — not selected";
    case "transformed_selected":
      return "Transformed analysis selected for inference";
  }
}

export function authorityDetail(state: AuthorityState): string {
  switch (state) {
    case "raw_primary":
      return "The original-scale analysis carries inferential authority.";
    case "explored_not_selected":
      return (
        "A transformation has been explored but NOT adopted. The original-scale analysis still carries " +
        "inferential authority — the ANOVA, mean separation and report above are unchanged."
      );
    case "transformed_selected":
      return (
        "The transformed branch now carries inferential authority for this response variable. The raw " +
        "analysis remains available as the original-scale reference."
      );
  }
}

// ── Selected-branch reading ──────────────────────────────────────────────────

export interface SelectedBranchDisplay {
  token: string;
  trait: string;
  alpha: number;
  diagnosticAlpha: number;
  lambda: LambdaDisplay | null;
  decisionSignificant: boolean | null;
  decisionPValue: number | null;
  residualMs: number | null;
  residualDf: number | null;
  tukeyStatus: string | null;
  tukeyMethod: string | null;
  tukeyMeansProvenance: string | null;
  /** Grouping letters from the TRANSFORMED branch — never raw letters. */
  tukeyRows: { level: string; mean: number; group: string }[];
  backTransformed: { treatment: string; estimate: number; interval: [number, number] | null; scaleLabel: string; intervalMethod: string | null }[];
  warnings: string[];
  acknowledgements: string[];
  interpretation: string | null;
  effectiveN: number | null;
}

export function readSelectedBranch(
  selected: SelectedTransformedAnalysis | null | undefined
): SelectedBranchDisplay | null {
  if (!selected) return null;
  const decision = (selected.treatment_decision ?? {}) as Record<string, unknown>;
  const tukey = (selected.tukey_result ?? {}) as Record<string, unknown>;
  const tukeyStatus = (selected.tukey_status ?? {}) as Record<string, unknown>;
  const levels = Array.isArray(tukey.genotype) ? (tukey.genotype as unknown[]).map(String) : [];
  const means = Array.isArray(tukey.mean) ? (tukey.mean as unknown[]).map(Number) : [];
  const groups = Array.isArray(tukey.group) ? (tukey.group as unknown[]).map(String) : [];

  return {
    token: selected.selected_analysis_token,
    trait: selected.trait,
    alpha: selected.inferential_alpha,
    diagnosticAlpha: selected.diagnostic_alpha,
    lambda: readLambda(selected.transformation as Record<string, unknown>),
    decisionSignificant:
      typeof decision.significant === "boolean" ? decision.significant : null,
    decisionPValue: asNumber(decision.p_value),
    residualMs: asNumber(selected.residual_ms),
    residualDf: asNumber(selected.residual_df),
    tukeyStatus: typeof tukeyStatus.status === "string" ? tukeyStatus.status : null,
    tukeyMethod: typeof tukeyStatus.method === "string" ? tukeyStatus.method : null,
    tukeyMeansProvenance:
      typeof tukeyStatus.means_provenance === "string" ? tukeyStatus.means_provenance : null,
    tukeyRows: levels.map((level, i) => ({
      level,
      mean: means[i],
      group: groups[i] ?? "",
    })),
    backTransformed: (selected.back_transformed_estimates ?? []).map((e) => {
      const row = e as Record<string, unknown>;
      const ci = Array.isArray(row.confidence_interval)
        ? (row.confidence_interval as unknown[]).map(Number)
        : null;
      return {
        treatment: String(row.treatment ?? ""),
        estimate: Number(row.estimate),
        interval: ci && ci.length === 2 ? ([ci[0], ci[1]] as [number, number]) : null,
        // The backend labels these "Back-transformed model estimate". They are
        // NOT raw means and must never be presented as the original data's means.
        scaleLabel:
          typeof row.scale_label === "string" ? row.scale_label : "Back-transformed model estimate",
        intervalMethod: typeof row.interval_method === "string" ? row.interval_method : null,
      };
    }),
    warnings: asStringList(selected.warnings),
    acknowledgements: asStringList(selected.acknowledgements),
    interpretation: typeof selected.interpretation === "string" ? selected.interpretation : null,
    effectiveN: asNumber(selected.effective_n),
  };
}

// ── Identity failure ─────────────────────────────────────────────────────────

/**
 * Explain a backend identity rejection.
 *
 * Every one of these means the exact analysis the token names is gone or does
 * not match. Reconstructing state locally, or falling back to another cached
 * analysis, would produce a report that does not belong to what is on screen —
 * exactly what exact-token identity exists to prevent.
 */
export function describeTransformationFailure(message: string): string {
  const text = message || "";
  if (/not eligible for inferential selection/i.test(text)) {
    // The UI already disables selection for an ineligible branch; reaching this
    // means the backend caught it anyway, which is the behaviour we want.
    return (
      "This transformed branch is not eligible for inferential selection — the exploration did not " +
      "identify a stable transformation. The raw analysis remains authoritative."
    );
  }
  if (/model-frame identity does not match/i.test(text) || /Trait or model-frame/i.test(text)) {
    return (
      "This transformed branch no longer matches the analysis it was explored from — the trait, the " +
      "selected α or the model frame has changed. Re-run the exploration from the current raw analysis " +
      "before selecting it."
    );
  }
  if (/selected analysis is unavailable or expired/i.test(text)) {
    return (
      "The selected transformed analysis is no longer available for secure export. This usually happens " +
      "after the analysis service restarts. Re-run the analysis, explore the transformation again and " +
      "re-select it — no substitute report will be produced."
    );
  }
  if (/no longer available for secure export/i.test(text)) {
    return (
      "The original analysis identity is no longer available for secure export. Please rerun the " +
      "analysis and download the report again."
    );
  }
  if (/expired|unavailable|not found/i.test(text)) {
    return (
      "The exact analysis identity this step depends on is no longer available. Re-run the analysis and " +
      "explore the transformation again."
    );
  }
  return text || "The transformation step could not be completed.";
}

// ── Raw immutability ─────────────────────────────────────────────────────────

/**
 * Snapshot of the raw analysis, used to prove exploration and selection leave
 * it untouched. The raw branch is a separate object with its own identity, and
 * nothing in this workflow writes to it.
 */
export interface RawSnapshot {
  exportToken: string | null;
  decisionSignificant: boolean | null;
  decisionPValue: number | null;
  tukeyGroups: string[];
  tukeyMeans: number[];
}

export function snapshotRaw(
  response: UploadAnalysisResponse,
  trait: string
): RawSnapshot | null {
  const result = response.trait_results?.[trait]?.analysis_result?.result;
  if (!result) return null;
  return {
    exportToken: response.export_token ?? null,
    decisionSignificant: result.treatment_decision?.significant ?? null,
    decisionPValue: result.treatment_decision?.p_value ?? null,
    tukeyGroups: result.mean_separation?.group ? [...result.mean_separation.group] : [],
    tukeyMeans: result.mean_separation?.mean ? [...result.mean_separation.mean] : [],
  };
}

export function rawSnapshotsEqual(a: RawSnapshot | null, b: RawSnapshot | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.exportToken === b.exportToken &&
    a.decisionSignificant === b.decisionSignificant &&
    a.decisionPValue === b.decisionPValue &&
    a.tukeyGroups.join("|") === b.tukeyGroups.join("|") &&
    a.tukeyMeans.join("|") === b.tukeyMeans.join("|")
  );
}
