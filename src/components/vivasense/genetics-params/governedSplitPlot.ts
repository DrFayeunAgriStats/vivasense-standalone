/**
 * Governed Split-Plot RCBD v1 presentation logic.
 *
 * The scientific content of a split-plot is that it has TWO error strata, and
 * that which stratum a term is tested against is not a detail — it is the
 * design. Testing the whole-plot factor against the subplot error inflates its
 * F enormously (in one reference fixture, F = 2550 instead of 15), so the
 * denominator each decision actually used is displayed rather than implied.
 *
 * Everything is read from the backend decision objects. Nothing here computes
 * a denominator, an F, a Satterthwaite term, or a significance verdict.
 */

import type {
  GeneticsResult,
  GovernedDecision,
  MeanSeparation,
  MeanSeparationStatus,
} from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "./anovaDesigns";
import { formatAlpha, formatP } from "./governedOneFactor";

/** A non-empty plain object. jsonlite serialises an R NULL as `{}`. */
export function isPopulated(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

function isDecision(value: unknown): value is GovernedDecision {
  return isPopulated(value) && typeof (value as GovernedDecision).significant === "boolean";
}

/**
 * Governed only when the profile AND all three decisions are genuinely present.
 *
 * Deliberately NOT inferred from `main_plot_mean_separation`, from interaction
 * means, or from ANOVA source names. That was SPF-1: identity was derived from
 * the whole-plot separation object, so the moment a non-significant whole-plot
 * factor correctly withheld its protected LSD, the report stopped recognising
 * the run as a split-plot and dropped every section. A non-significant factor
 * is an ordinary result, not a change of design.
 */
export function isGovernedSplitPlot(
  result: GeneticsResult | null | undefined,
  design: GovernedDesignType
): boolean {
  if (!result || design !== "split_plot_rcbd") return false;
  if (!isPopulated(result.split_plot_profile)) return false;
  return (
    isDecision(result.whole_plot_decision) &&
    isDecision(result.sub_plot_decision) &&
    isDecision(result.split_plot_interaction_decision)
  );
}

// ── Design structure ─────────────────────────────────────────────────────────

export interface SplitPlotProfileInfo {
  blockFactor: string;
  blockCount: number | null;
  wholePlotFactor: string;
  wholePlotLevels: string[];
  subPlotFactor: string;
  subPlotLevels: string[];
  wholePlots: number | null;
  subPlots: number | null;
  expectedObservations: number | null;
  analysedObservations: number | null;
  modelFormula: string | null;
  replicationNote: string | null;
  denominators: { wholePlot?: string; subPlot?: string; interaction?: string };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Engine-internal placeholders that are not the user's real column name. */
const GENERIC_BLOCK_TOKENS = new Set(["rep", "reps", "block", "blocks", "replication"]);

/**
 * Read split-plot structure from `split_plot_profile` only.
 *
 * The one concession to the mapping: the profile reports `block_factor: "rep"`,
 * which is the engine's internal token rather than the column the user chose.
 * Where the profile gives such a placeholder and the user mapped a real column,
 * the user's name is shown — it identifies the same term more usefully. Every
 * other structural fact comes from the profile and is gate-independent.
 */
export function readSplitPlotProfile(
  result: GeneticsResult,
  mapping: { rep?: string; mainPlot?: string; subPlot?: string } = {}
): SplitPlotProfileInfo | null {
  const profile = result.split_plot_profile as Record<string, unknown> | null | undefined;
  if (!isPopulated(profile)) return null;

  const rawBlock = typeof profile.block_factor === "string" ? profile.block_factor : "";
  const blockFactor =
    rawBlock && !GENERIC_BLOCK_TOKENS.has(rawBlock.toLowerCase())
      ? rawBlock
      : (mapping.rep || rawBlock || "Block");

  const denom = isPopulated(profile.denominators)
    ? (profile.denominators as Record<string, unknown>)
    : {};

  return {
    blockFactor,
    blockCount: asNumber(profile.block_count),
    wholePlotFactor:
      (typeof profile.whole_plot_factor === "string" && profile.whole_plot_factor) ||
      mapping.mainPlot ||
      "Whole-plot factor",
    wholePlotLevels: asStringArray(profile.whole_plot_levels),
    subPlotFactor:
      (typeof profile.sub_plot_factor === "string" && profile.sub_plot_factor) ||
      mapping.subPlot ||
      "Subplot factor",
    subPlotLevels: asStringArray(profile.sub_plot_levels),
    wholePlots: asNumber(profile.whole_plots),
    subPlots: asNumber(profile.sub_plots),
    expectedObservations: asNumber(profile.expected_observations),
    analysedObservations: asNumber(profile.analysed_observations),
    modelFormula: typeof profile.model_formula === "string" ? profile.model_formula : null,
    replicationNote:
      typeof profile.replication_note === "string" ? profile.replication_note : null,
    denominators: {
      wholePlot: typeof denom.whole_plot_factor === "string" ? denom.whole_plot_factor : undefined,
      subPlot: typeof denom.sub_plot_factor === "string" ? denom.sub_plot_factor : undefined,
      interaction: typeof denom.interaction === "string" ? denom.interaction : undefined,
    },
  };
}

export interface SummaryRow {
  label: string;
  value: string;
  note?: string;
}

export function buildSplitPlotSummary(
  info: SplitPlotProfileInfo,
  alpha: number
): SummaryRow[] {
  const rows: SummaryRow[] = [{ label: "Design", value: "Split-Plot RCBD" }];

  rows.push({
    label: "Replication / block factor",
    value: info.blockCount !== null ? `${info.blockFactor} · ${info.blockCount} blocks` : info.blockFactor,
    note: "Design structure — blocks account for background variation and are not a treatment being compared.",
  });
  rows.push({
    label: "Whole-plot factor (A)",
    value: info.wholePlotLevels.length
      ? `${info.wholePlotFactor} · ${info.wholePlotLevels.length} levels`
      : info.wholePlotFactor,
    note: info.wholePlotLevels.length ? info.wholePlotLevels.join(", ") : undefined,
  });
  rows.push({
    label: "Subplot factor (B)",
    value: info.subPlotLevels.length
      ? `${info.subPlotFactor} · ${info.subPlotLevels.length} levels`
      : info.subPlotFactor,
    note: info.subPlotLevels.length ? info.subPlotLevels.join(", ") : undefined,
  });
  if (info.wholePlots !== null) rows.push({ label: "Whole plots", value: String(info.wholePlots) });
  if (info.subPlots !== null) rows.push({ label: "Subplots", value: String(info.subPlots) });
  if (info.analysedObservations !== null) {
    rows.push({
      label: "Observations analysed",
      value:
        info.expectedObservations !== null && info.expectedObservations !== info.analysedObservations
          ? `${info.analysedObservations} of ${info.expectedObservations}`
          : String(info.analysedObservations),
    });
  }
  if (info.modelFormula) {
    rows.push({ label: "Model", value: info.modelFormula });
  }
  rows.push({ label: "Inferential α", value: formatAlpha(alpha) });
  return rows;
}

// ── Experimental-unit accounting ─────────────────────────────────────────────

export interface ExperimentalUnitDisplay {
  statements: string[];
  /** The engine's own replication note, when it sent one. */
  engineNote: string | null;
}

/**
 * State what the experimental unit is for each factor.
 *
 * This is the single most misread feature of a split-plot: subplots look like
 * replication, so the whole-plot factor appears far better replicated than it
 * is. Saying so plainly is worth more than any amount of correct arithmetic
 * further down the page.
 */
export function describeExperimentalUnits(
  info: SplitPlotProfileInfo
): ExperimentalUnitDisplay {
  return {
    statements: [
      `${info.wholePlotFactor} is applied to whole plots, so the whole plot is its experimental unit. Subplots within the same whole plot are therefore not independent replicates of ${info.wholePlotFactor}.`,
      `${info.subPlotFactor} and the ${info.wholePlotFactor} × ${info.subPlotFactor} interaction are applied within whole plots, so the subplot is their experimental unit.`,
      `This is why ${info.wholePlotFactor} is tested on the whole-plot error stratum with fewer degrees of freedom, while ${info.subPlotFactor} and the interaction are tested on the subplot error stratum.`,
    ],
    engineNote: info.replicationNote,
  };
}

// ── Error strata ─────────────────────────────────────────────────────────────

export interface StratumDisplay {
  name: string;
  role: string;
  df: number | null;
  ms: number | null;
  testedTerms: string[];
}

/**
 * Build the two error strata from the decision objects.
 *
 * Denominator df and MS are read from `whole_plot_decision` and
 * `sub_plot_decision`; nothing is recomputed. If the engine ever changed which
 * stratum a term used, this display would change with it rather than continue
 * asserting the textbook mapping.
 */
export function readErrorStrata(
  result: GeneticsResult,
  info: SplitPlotProfileInfo
): StratumDisplay[] {
  const whole = (result.whole_plot_decision ?? {}) as GovernedDecision;
  const sub = (result.sub_plot_decision ?? {}) as GovernedDecision;
  const inter = (result.split_plot_interaction_decision ?? {}) as GovernedDecision;

  const strata: StratumDisplay[] = [];

  if (isDecision(whole)) {
    strata.push({
      name: typeof whole.error_stratum === "string" ? whole.error_stratum : "Error A",
      role: `Whole-plot error (Block × ${info.wholePlotFactor})`,
      df: asNumber(whole.denominator_df),
      ms: asNumber(whole.denominator_ms),
      testedTerms: [info.wholePlotFactor],
    });
  }

  if (isDecision(sub)) {
    const terms = [info.subPlotFactor];
    if (
      isDecision(inter) &&
      String(inter.error_stratum ?? "") === String(sub.error_stratum ?? "")
    ) {
      terms.push(`${info.wholePlotFactor} × ${info.subPlotFactor}`);
    }
    strata.push({
      name: typeof sub.error_stratum === "string" ? sub.error_stratum : "Error B",
      role: "Subplot (residual) error",
      df: asNumber(sub.denominator_df),
      ms: asNumber(sub.denominator_ms),
      testedTerms: terms,
    });
  }

  // If the engine ever put the interaction on a third stratum, show it rather
  // than quietly filing it under Error B.
  if (
    isDecision(inter) &&
    isDecision(sub) &&
    String(inter.error_stratum ?? "") !== String(sub.error_stratum ?? "")
  ) {
    strata.push({
      name: typeof inter.error_stratum === "string" ? inter.error_stratum : "Interaction error",
      role: "Interaction error stratum",
      df: asNumber(inter.denominator_df),
      ms: asNumber(inter.denominator_ms),
      testedTerms: [`${info.wholePlotFactor} × ${info.subPlotFactor}`],
    });
  }

  return strata;
}

// ── Decision table ───────────────────────────────────────────────────────────

export interface SplitPlotTermDecision {
  key: "a" | "b" | "ab";
  term: string;
  significant: boolean;
  estimable: boolean;
  pText: string;
  alpha: number;
  errorStratum: string;
  denominatorDf: number | null;
  denominatorMs: number | null;
}

export function readSplitPlotDecisions(
  result: GeneticsResult,
  info: SplitPlotProfileInfo
): SplitPlotTermDecision[] {
  const build = (
    key: SplitPlotTermDecision["key"],
    term: string,
    decision: unknown
  ): SplitPlotTermDecision | null => {
    if (!isDecision(decision)) return null;
    const d = decision as GovernedDecision;
    return {
      key,
      term,
      significant: d.significant === true,
      estimable: d.estimable !== false,
      pText: formatP(asNumber(d.p_value)),
      alpha: asNumber(d.alpha) ?? 0.05,
      errorStratum: typeof d.error_stratum === "string" ? d.error_stratum : "—",
      denominatorDf: asNumber(d.denominator_df),
      denominatorMs: asNumber(d.denominator_ms),
    };
  };

  return [
    build("a", info.wholePlotFactor, result.whole_plot_decision),
    build("b", info.subPlotFactor, result.sub_plot_decision),
    build("ab", `${info.wholePlotFactor} × ${info.subPlotFactor}`, result.split_plot_interaction_decision),
  ].filter((d): d is SplitPlotTermDecision => d !== null);
}

// ── Hierarchy ────────────────────────────────────────────────────────────────

export interface SplitPlotHierarchy {
  interactionSignificant: boolean;
  headline: string;
  marginalGuidance: string;
  /** Always present when the interaction is significant. */
  limitation: string | null;
}

export const NO_SIMPLE_EFFECTS_NOTICE =
  "Formal simple-effects inference is not provided in Split-Plot RCBD v1. Comparing the whole-plot " +
  "factor within a level of the subplot factor requires a Satterthwaite-approximated denominator " +
  "combining both error strata, which v1 does not compute. The cell means and interaction plot below " +
  "are descriptive only — they are not simple-effects tests.";

export function describeSplitPlotHierarchy(
  decisions: SplitPlotTermDecision[],
  info: SplitPlotProfileInfo
): SplitPlotHierarchy | null {
  const ab = decisions.find((d) => d.key === "ab");
  const a = decisions.find((d) => d.key === "a");
  const b = decisions.find((d) => d.key === "b");
  if (!ab) return null;
  const alphaText = `α = ${formatAlpha(ab.alpha)}`;
  const word = (d?: SplitPlotTermDecision) =>
    !d ? "not reported" : !d.estimable ? "not estimable" : d.significant ? "significant" : "not significant";

  if (ab.significant) {
    return {
      interactionSignificant: true,
      headline:
        `The ${info.wholePlotFactor} × ${info.subPlotFactor} interaction was significant at ${alphaText} ` +
        `(${ab.pText}, tested on ${ab.errorStratum}). This is the primary inferential result: the effect of ` +
        `${info.wholePlotFactor} depends on the level of ${info.subPlotFactor}, and vice versa.`,
      marginalGuidance:
        `The ${info.wholePlotFactor} marginal main effect was ${word(a)} and the ${info.subPlotFactor} ` +
        `marginal main effect was ${word(b)} at ${alphaText}. Under a significant interaction these average ` +
        "over the dependence the interaction establishes, so they are secondary summaries and must not be " +
        "read as unconditional effects of either factor.",
      limitation: NO_SIMPLE_EFFECTS_NOTICE,
    };
  }

  return {
    interactionSignificant: false,
    headline:
      `The ${info.wholePlotFactor} × ${info.subPlotFactor} interaction was not significant at ${alphaText} ` +
      `(${ab.pText}), so each factor's marginal main effect is interpretable on its own.`,
    marginalGuidance:
      `The ${info.wholePlotFactor} main effect was ${word(a)} (tested on ${a?.errorStratum ?? "its own stratum"}) ` +
      `and the ${info.subPlotFactor} main effect was ${word(b)} (tested on ${b?.errorStratum ?? "its own stratum"}) ` +
      `at ${alphaText}.`,
    limitation: null,
  };
}

// ── Protected Fisher's LSD ───────────────────────────────────────────────────

export interface ProtectedLsdDisplay {
  factor: string;
  tone: "success" | "withheld" | "not_estimable" | "failed" | "unknown";
  heading: string;
  detail: string;
  method: string | null;
  alpha: number | null;
  errorStratum: string | null;
  errorDf: number | null;
  errorMs: number | null;
  meansProvenance: string | null;
  protection: string | null;
  separation: MeanSeparation | null;
  showLetters: boolean;
  /** False while the interaction governs, even when the gate opened. */
  authoritative: boolean;
}

/**
 * Describe one factor's protected Fisher's LSD gate.
 *
 * Each factor has its OWN omnibus gate on its OWN error stratum: a significant
 * whole-plot factor does not open the subplot factor's separation, and vice
 * versa. Nothing is ever computed client-side, and no Tukey is substituted.
 */
export function describeProtectedLsd(
  factorLabel: string,
  status: MeanSeparationStatus | null | undefined,
  separation: MeanSeparation | null | undefined,
  interactionGoverns: boolean
): ProtectedLsdDisplay | null {
  const hasLetters = !!separation?.group?.length;
  if (!isPopulated(status) && !hasLetters) return null;

  const s = (status ?? {}) as MeanSeparationStatus;
  const raw = String(s.status ?? (hasLetters ? "success" : "")).toLowerCase();
  const method = typeof s.method === "string" ? s.method : null;
  const alpha = asNumber(s.alpha);
  const stratum = typeof s.error_stratum === "string" ? s.error_stratum : null;
  const alphaText = alpha === null ? "the selected α" : `α = ${formatAlpha(alpha)}`;

  let tone: ProtectedLsdDisplay["tone"] = "unknown";
  let heading = `${factorLabel} mean separation`;
  let detail = typeof s.message === "string" ? s.message : "";
  let showLetters = hasLetters;

  if (raw === "success") {
    tone = "success";
    heading = `${factorLabel} — ${method ?? "Protected Fisher's LSD"}`;
    detail =
      `The ${factorLabel} omnibus test met ${alphaText}, so ${method ?? "protected LSD"} was carried out` +
      (stratum ? ` on ${stratum}.` : ".");
  } else if (raw === "not_run_omnibus_not_significant") {
    tone = "withheld";
    heading = `${factorLabel} mean separation withheld`;
    detail =
      `The ${factorLabel} omnibus test did not meet ${alphaText}, so ${method ?? "protected LSD"} was ` +
      "deliberately not run. Fisher's LSD is protected by that omnibus test — running it anyway would " +
      "forfeit the protection. This is not a missing result.";
    showLetters = false;
  } else if (raw === "not_estimable") {
    tone = "not_estimable";
    heading = `${factorLabel} mean separation not estimable`;
    detail = detail || "The comparison could not be estimated from this design and data.";
    showLetters = false;
  } else if (raw === "failed") {
    tone = "failed";
    heading = `${factorLabel} mean separation failed`;
    detail =
      (detail || "The mean-separation step did not complete.") +
      " The split-plot ANOVA itself completed — only this post-hoc step failed.";
    showLetters = false;
  }

  const authoritative = tone === "success" && !interactionGoverns;
  if (interactionGoverns) showLetters = false;

  return {
    factor: factorLabel,
    tone,
    heading,
    detail,
    method,
    alpha,
    errorStratum: stratum,
    errorDf: asNumber(s.error_df),
    errorMs: asNumber(s.error_ms),
    meansProvenance: typeof s.means_provenance === "string" ? s.means_provenance : null,
    protection: typeof s.protection === "string" ? s.protection : null,
    separation: separation ?? null,
    showLetters,
    authoritative,
  };
}

// ── Interaction means / plot ─────────────────────────────────────────────────

export interface CellMeanRow {
  wholePlotLevel: string;
  subPlotLevel: string;
  mean: number;
}

export interface InteractionMeansDisplay {
  rows: CellMeanRow[];
  wholePlotLevels: string[];
  subPlotLevels: string[];
  scaleLabel: string;
  cellSe: number | null;
  note: string;
}

/**
 * Read the descriptive A × B cell means.
 *
 * These are CELL ARITHMETIC MEANS and nothing else — not adjusted means, not
 * LSMeans, not EMMs, and emphatically not simple-effect estimates. v1 computes
 * no simple-effects inference, so any letters or comparisons implied here would
 * be inventing a test the engine did not run.
 */
export function readInteractionMeans(
  result: GeneticsResult
): InteractionMeansDisplay | null {
  const means = result.interaction_means as Record<string, unknown> | null | undefined;
  if (!isPopulated(means)) return null;
  const cells = isPopulated(means.cell_means)
    ? (means.cell_means as Record<string, unknown>)
    : null;
  if (!cells) return null;

  const wp = asStringArray(cells.main_plot);
  const sp = asStringArray(cells.sub_plot);
  const values = Array.isArray(cells.trait_value)
    ? (cells.trait_value as unknown[]).map(Number)
    : [];
  if (wp.length === 0 || values.length === 0) return null;

  return {
    rows: wp.map((level, i) => ({
      wholePlotLevel: level,
      subPlotLevel: sp[i] ?? "",
      mean: values[i],
    })),
    wholePlotLevels: asStringArray(means.main_plot_levels),
    subPlotLevels: asStringArray(means.sub_plot_levels),
    scaleLabel:
      typeof means.scale_label === "string" ? means.scale_label : "Cell arithmetic mean",
    cellSe: asNumber(means.cell_se),
    note:
      "Cell arithmetic means describing the observed pattern across whole-plot and subplot levels. " +
      "They are descriptive summaries, not simple-effects estimates.",
  };
}

export interface SplitPlotPlotSeries {
  label: string;
  xLevels: string[];
  means: number[];
}

export interface SplitPlotPlotDisplay {
  xAxisFactor: string;
  lineFactor: string;
  xLevels: string[];
  series: SplitPlotPlotSeries[];
  scaleLabel: string;
  note: string;
}

export const PLOT_SIGNIFICANCE_NOTE =
  "The interaction F-test, not the visual shape of the lines, determines statistical significance.";

/** Reshape the governed cell means into plot series (whole plot on x, subplot as lines). */
export function readSplitPlotInteractionPlot(
  result: GeneticsResult,
  info: SplitPlotProfileInfo
): SplitPlotPlotDisplay | null {
  const means = readInteractionMeans(result);
  if (!means) return null;

  const xLevels = means.wholePlotLevels.length
    ? means.wholePlotLevels
    : Array.from(new Set(means.rows.map((r) => r.wholePlotLevel)));
  const lineLevels = means.subPlotLevels.length
    ? means.subPlotLevels
    : Array.from(new Set(means.rows.map((r) => r.subPlotLevel)));
  if (xLevels.length === 0 || lineLevels.length === 0) return null;

  const lookup = new Map(means.rows.map((r) => [`${r.wholePlotLevel}|${r.subPlotLevel}`, r.mean]));
  const series = lineLevels.map((line) => ({
    label: line,
    xLevels,
    means: xLevels.map((x) => lookup.get(`${x}|${line}`) ?? NaN),
  }));

  return {
    xAxisFactor: info.wholePlotFactor,
    lineFactor: info.subPlotFactor,
    xLevels,
    series,
    scaleLabel: means.scaleLabel,
    note: PLOT_SIGNIFICANCE_NOTE,
  };
}

// ── Diagnostics disclosure ───────────────────────────────────────────────────

/**
 * Split-plot-specific diagnostics disclosure.
 *
 * Residual diagnostics from a split-plot fit describe the SUBPLOT stratum; they
 * say little about whole-plot error, which has far fewer degrees of freedom.
 * Presenting one set of residual plots as though it validated both strata would
 * overstate what the evidence covers.
 */
export function splitPlotDiagnosticStatements(info: SplitPlotProfileInfo): string[] {
  return [
    `Residual diagnostics from this model relate primarily to the subplot (Error B) stratum, which is where ${info.subPlotFactor} and the interaction are tested.`,
    `Whole-plot (Error A) inference for ${info.wholePlotFactor} rests on far fewer degrees of freedom and is not directly assessed by those residual plots.`,
    "Independence follows from how the experiment was randomised — whole plots within blocks, subplots within whole plots — and cannot be established from residuals.",
  ];
}
