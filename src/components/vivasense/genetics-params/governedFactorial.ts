/**
 * Governed Factorial CRD / RCBD v1 presentation logic.
 *
 * The organising principle is the interaction-first hierarchy. When A × B is
 * significant, the effect of one factor depends on the level of the other, so a
 * flat claim like "Factor A significantly affected the response" is not merely
 * incomplete — it is wrong, because there is no single Factor A effect to state.
 * Everything below derives from the backend decision objects; nothing recomputes
 * significance from the ANOVA table.
 */

import type {
  GeneticsResult,
  GovernedDecision,
  MeanSeparation,
  MeanSeparationStatus,
} from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "./anovaDesigns";
import { formatAlpha, formatP } from "./governedOneFactor";

export const FACTORIAL_DESIGNS: GovernedDesignType[] = ["factorial_crd", "factorial_rcbd"];

export function isFactorialDesign(design: GovernedDesignType): boolean {
  return FACTORIAL_DESIGNS.includes(design);
}

/** A non-empty plain object. jsonlite turns an R NULL into `{}`. */
function isPopulated(value: unknown): value is Record<string, unknown> {
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
 * Governed only when the profile AND all three decisions are really present.
 *
 * Deliberately not inferred from Tukey output, interaction means, or the design
 * label: any of those can exist on a result the engine never governed, and the
 * FV1-2 defect came precisely from deriving structure out of post-hoc objects.
 */
export function isGovernedFactorial(
  result: GeneticsResult | null | undefined,
  design: GovernedDesignType
): boolean {
  if (!result || !isFactorialDesign(design)) return false;
  if (!isPopulated(result.factorial_profile)) return false;
  const profile = result.factorial_profile as Record<string, unknown>;
  if (profile.balanced_complete_required !== true) return false;
  return (
    isDecision(result.factor_a_decision) &&
    isDecision(result.factor_b_decision) &&
    isDecision(result.interaction_decision)
  );
}

// ── Design / factor information ──────────────────────────────────────────────

export interface FactorialProfileInfo {
  design: GovernedDesignType;
  designLabel: string;
  factorA: string;
  factorB: string;
  factorALevels: string[];
  factorBLevels: string[];
  treatmentCombinations: number | null;
  replications: number | null;
  blockFactor: string | null;
  blocks: number | null;
  modelFormula: string | null;
  hasBlockTerm: boolean;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Read design structure from `factorial_profile` ONLY.
 *
 * Never from Tukey results, simple effects or mean-separation objects — that
 * was FV1-2, where the report's Factor Information vanished whenever a marginal
 * post-hoc was withheld, because the structure had been derived from the very
 * object the gate had suppressed. Design structure is gate-independent.
 */
export function readFactorialProfile(
  result: GeneticsResult,
  design: GovernedDesignType,
  mapping: { rep?: string } = {}
): FactorialProfileInfo | null {
  const profile = result.factorial_profile as Record<string, unknown> | null | undefined;
  if (!isPopulated(profile)) return null;

  const declared = typeof profile.design === "string" ? profile.design : design;
  const isRcbd = declared === "factorial_rcbd" || design === "factorial_rcbd";

  const blockFactor =
    (typeof profile.block_factor === "string" && profile.block_factor) ||
    (typeof profile.rep_factor === "string" && profile.rep_factor) ||
    (typeof profile.block_column === "string" && profile.block_column) ||
    (isRcbd ? (mapping.rep ?? null) : null);

  const blocks =
    asNumber(profile.blocks) ??
    asNumber(profile.n_blocks) ??
    (isRcbd ? asNumber(profile.replications) : null);

  return {
    design: isRcbd ? "factorial_rcbd" : "factorial_crd",
    designLabel: isRcbd ? "Factorial RCBD" : "Factorial CRD",
    factorA: typeof profile.factor_a === "string" ? profile.factor_a : "Factor A",
    factorB: typeof profile.factor_b === "string" ? profile.factor_b : "Factor B",
    factorALevels: asStringArray(profile.factor_a_levels),
    factorBLevels: asStringArray(profile.factor_b_levels),
    treatmentCombinations: asNumber(profile.treatment_combinations),
    replications: asNumber(profile.replications),
    blockFactor: isRcbd ? blockFactor : null,
    blocks: isRcbd ? blocks : null,
    modelFormula: typeof profile.model_formula === "string" ? profile.model_formula : null,
    hasBlockTerm: isRcbd,
  };
}

export interface SummaryRow {
  label: string;
  value: string;
  note?: string;
}

export function buildFactorialSummary(
  info: FactorialProfileInfo,
  alpha: number,
  observationsAnalysed?: string | null
): SummaryRow[] {
  const rows: SummaryRow[] = [{ label: "Design", value: info.designLabel }];

  rows.push({
    label: "Factor A",
    value: info.factorALevels.length
      ? `${info.factorA} · ${info.factorALevels.length} levels`
      : info.factorA,
    note: info.factorALevels.length ? info.factorALevels.join(", ") : undefined,
  });
  rows.push({
    label: "Factor B",
    value: info.factorBLevels.length
      ? `${info.factorB} · ${info.factorBLevels.length} levels`
      : info.factorB,
    note: info.factorBLevels.length ? info.factorBLevels.join(", ") : undefined,
  });

  if (info.treatmentCombinations !== null) {
    rows.push({ label: "Treatment combinations", value: String(info.treatmentCombinations) });
  }

  if (info.hasBlockTerm) {
    if (info.blockFactor) {
      rows.push({
        label: "Replication / block factor",
        value: info.blockFactor,
        note: "Part of the design structure — blocks account for background variation and are not a treatment being compared.",
      });
    }
    if (info.blocks !== null) rows.push({ label: "Blocks", value: String(info.blocks) });
    rows.push({
      label: "Model",
      value: info.modelFormula ?? "block + A × B",
      note: "The block enters the model as a design term alongside the factorial treatment structure.",
    });
  } else {
    if (info.replications !== null) {
      rows.push({
        label: "Replicates per combination",
        value: String(info.replications),
        note: "Independent experimental units.",
      });
    }
    rows.push({
      label: "Model",
      value: info.modelFormula ?? "A × B",
      note: "Completely randomised — no blocking term is fitted.",
    });
  }

  if (observationsAnalysed) {
    rows.push({ label: "Observations analysed", value: observationsAnalysed });
  }
  rows.push({ label: "Inferential α", value: formatAlpha(alpha) });
  return rows;
}

// ── The three decisions ──────────────────────────────────────────────────────

export interface TermDecision {
  key: "a" | "b" | "ab";
  term: string;
  significant: boolean;
  estimable: boolean;
  pText: string;
  alpha: number;
  rule: string;
}

export function readDecisions(
  result: GeneticsResult,
  info: FactorialProfileInfo
): TermDecision[] {
  const build = (
    key: TermDecision["key"],
    term: string,
    decision: GovernedDecision | null | undefined
  ): TermDecision | null => {
    if (!isDecision(decision)) return null;
    const alpha = typeof decision.alpha === "number" ? decision.alpha : 0.05;
    return {
      key,
      term,
      significant: decision.significant === true,
      estimable: decision.estimable !== false,
      pText: formatP(typeof decision.p_value === "number" ? decision.p_value : null),
      alpha,
      rule:
        typeof decision.rule === "string"
          ? decision.rule.replace("p_value <= alpha", "p ≤ α")
          : "p ≤ α",
    };
  };

  return [
    build("a", info.factorA, result.factor_a_decision),
    build("b", info.factorB, result.factor_b_decision),
    build("ab", `${info.factorA} × ${info.factorB}`, result.interaction_decision),
  ].filter((d): d is TermDecision => d !== null);
}

// ── Interaction-first hierarchy ──────────────────────────────────────────────

export interface HierarchyDisplay {
  interactionSignificant: boolean;
  /** Lead sentence — the primary inferential result. */
  headline: string;
  /** How the marginal main effects must be read. */
  marginalGuidance: string;
  /** What governs comparison of means. */
  separationGuidance: string;
  /** True when simple effects are the authoritative comparison. */
  simpleEffectsGovern: boolean;
}

/**
 * State the hierarchy.
 *
 * Under a significant interaction the wording never asserts an unconditional
 * main effect. "Factor A significantly affected the response" would describe an
 * effect that does not exist as a single quantity — the whole content of a
 * significant interaction is that the Factor A effect differs by Factor B level.
 */
export function describeHierarchy(
  decisions: TermDecision[],
  info: FactorialProfileInfo
): HierarchyDisplay | null {
  const ab = decisions.find((d) => d.key === "ab");
  const a = decisions.find((d) => d.key === "a");
  const b = decisions.find((d) => d.key === "b");
  if (!ab) return null;

  const alphaText = `α = ${formatAlpha(ab.alpha)}`;

  if (ab.significant) {
    return {
      interactionSignificant: true,
      headline:
        `The ${info.factorA} × ${info.factorB} interaction was significant at ${alphaText} (${ab.pText}). ` +
        `This is the primary inferential result: the effect of ${info.factorA} depends on the level of ` +
        `${info.factorB}, and vice versa.`,
      marginalGuidance:
        `The ${info.factorA} marginal main effect was ${a ? word(a) : "not reported"} and the ` +
        `${info.factorB} marginal main effect was ${b ? word(b) : "not reported"} at ${alphaText}. ` +
        "Under a significant interaction these marginal effects average over the dependence the " +
        "interaction establishes, so they are secondary summaries and must not be read as " +
        "unconditional effects of either factor.",
      separationGuidance:
        "Simple effects — one factor compared within each level of the other — are the governing " +
        "comparison. They use the pooled residual error term from the full factorial model.",
      simpleEffectsGovern: true,
    };
  }

  return {
    interactionSignificant: false,
    headline:
      `The ${info.factorA} × ${info.factorB} interaction was not significant at ${alphaText} ` +
      `(${ab.pText}), so it is not supported at the selected α and each factor's marginal main ` +
      "effect is interpretable on its own.",
    marginalGuidance:
      `The ${info.factorA} main effect was ${a ? word(a) : "not reported"} and the ` +
      `${info.factorB} main effect was ${b ? word(b) : "not reported"} at ${alphaText}.`,
    separationGuidance:
      "Marginal mean separation is the relevant comparison for a factor whose main effect met the " +
      "selected α.",
    simpleEffectsGovern: false,
  };
}

function word(d: TermDecision): string {
  if (!d.estimable) return "not estimable";
  return d.significant ? "significant" : "not significant";
}

// ── Simple effects ───────────────────────────────────────────────────────────

export interface SimpleEffectFamily {
  /** e.g. "FactorA compared within FactorB = B1" */
  family: string;
  movingFactor: string;
  fixedFactor: string;
  fixedLevel: string;
  status: string;
  message: string;
  alpha: number | null;
  levels: string[];
  means: number[];
  groups: string[];
  scaleLabel: string | null;
  multiplicity: string | null;
  showLetters: boolean;
}

export interface SimpleEffectsDisplay {
  status: string;
  message: string;
  errorTerm: string | null;
  multiplicity: string | null;
  alpha: number | null;
  aWithinB: SimpleEffectFamily[];
  bWithinA: SimpleEffectFamily[];
}

function readFamily(entry: unknown): SimpleEffectFamily | null {
  if (!isPopulated(entry)) return null;
  const e = entry as Record<string, unknown>;
  const status = String(e.status ?? "");
  return {
    family:
      (typeof e.comparison_family === "string" && e.comparison_family) ||
      `${String(e.moving_factor ?? "")} within ${String(e.fixed_factor ?? "")} = ${String(e.fixed_level ?? "")}`,
    movingFactor: String(e.moving_factor ?? ""),
    fixedFactor: String(e.fixed_factor ?? ""),
    fixedLevel: String(e.fixed_level ?? ""),
    status,
    message: typeof e.message === "string" ? e.message : "",
    alpha: asNumber(e.alpha),
    levels: asStringArray(e.levels),
    means: Array.isArray(e.mean) ? (e.mean as unknown[]).map((m) => Number(m)) : [],
    groups: asStringArray(e.group),
    scaleLabel: typeof e.scale_label === "string" ? e.scale_label : null,
    multiplicity: typeof e.multiplicity === "string" ? e.multiplicity : null,
    showLetters: status === "success" && asStringArray(e.group).length > 0,
  };
}

/**
 * Read the backend's governed simple effects in both directions.
 *
 * Nothing is recomputed here, and an all-cell Tukey is never substituted: the
 * two answer different questions, and the simple-effect families are each
 * multiplicity-controlled on their own rather than pooled across all cells.
 */
export function readSimpleEffects(result: GeneticsResult): SimpleEffectsDisplay | null {
  const effects = result.simple_effects;
  if (!isPopulated(effects)) return null;
  const status = result.simple_effects_status as Record<string, unknown> | null | undefined;

  const readList = (value: unknown): SimpleEffectFamily[] =>
    Array.isArray(value)
      ? value.map(readFamily).filter((f): f is SimpleEffectFamily => f !== null)
      : [];

  const e = effects as Record<string, unknown>;
  return {
    status: String(status?.status ?? "success"),
    message: typeof status?.message === "string" ? status.message : "",
    errorTerm: typeof status?.error_term === "string" ? status.error_term : null,
    multiplicity: typeof status?.multiplicity === "string" ? status.multiplicity : null,
    alpha: asNumber(status?.alpha),
    aWithinB: readList(e.moving_a_within_b),
    bWithinA: readList(e.moving_b_within_a),
  };
}

// ── Marginal post-hoc gates ──────────────────────────────────────────────────

export interface MarginalSeparationDisplay {
  factor: string;
  status: string;
  tone: "success" | "withheld" | "not_estimable" | "failed" | "unknown";
  heading: string;
  detail: string;
  method: string | null;
  alpha: number | null;
  meansProvenance: string | null;
  scaleLabel: string | null;
  separation: MeanSeparation | null;
  /** Letters are shown only when the gate opened AND the interaction does not govern. */
  showLetters: boolean;
  authoritative: boolean;
}

/**
 * Describe one factor's marginal post-hoc gate.
 *
 * Two independent things are tracked: whether the gate opened (a backend fact),
 * and whether the result is authoritative (a hierarchy fact). Under a
 * significant interaction a marginal Tukey may exist and still not govern, so
 * both are reported rather than collapsed into one flag.
 */
export function describeMarginalSeparation(
  factorLabel: string,
  status: MeanSeparationStatus | null | undefined,
  separation: MeanSeparation | null | undefined,
  interactionGoverns: boolean
): MarginalSeparationDisplay | null {
  const hasLetters = !!separation?.group?.length;
  if (!isPopulated(status) && !hasLetters) return null;

  const s = (status ?? {}) as MeanSeparationStatus;
  const raw = String(s.status ?? (hasLetters ? "success" : "")).toLowerCase();
  const method = typeof s.method === "string" ? s.method : null;
  const alpha = asNumber(s.alpha);
  const alphaText = alpha === null ? "the selected α" : `α = ${formatAlpha(alpha)}`;

  let tone: MarginalSeparationDisplay["tone"] = "unknown";
  let heading = `${factorLabel} marginal means`;
  let detail = typeof s.message === "string" ? s.message : "";
  let showLetters = hasLetters;

  if (raw === "success") {
    tone = "success";
    heading = `${factorLabel} marginal mean separation`;
    detail = `The ${factorLabel} main effect met ${alphaText}, so ${method ?? "mean separation"} was carried out on its marginal means.`;
    showLetters = hasLetters;
  } else if (raw === "not_run_omnibus_not_significant") {
    tone = "withheld";
    heading = `${factorLabel} mean separation withheld`;
    detail =
      `The ${factorLabel} main effect did not meet ${alphaText}, so ${method ?? "mean separation"} was deliberately not run. ` +
      "This is the protected procedure working as intended, not a missing result.";
    showLetters = false;
  } else if (raw === "not_estimable") {
    tone = "not_estimable";
    heading = `${factorLabel} mean separation not estimable`;
    detail = detail || "The comparison could not be estimated from this design and data.";
    showLetters = false;
  } else if (raw === "failed") {
    tone = "failed";
    heading = `${factorLabel} mean separation failed`;
    detail = (detail || "The mean-separation step did not complete.") +
      " The factorial ANOVA itself completed — only this post-hoc step failed.";
    showLetters = false;
  }

  // Under a significant interaction, marginal letters exist but do not govern.
  const authoritative = tone === "success" && !interactionGoverns;
  if (interactionGoverns) showLetters = false;

  return {
    factor: factorLabel,
    status: raw,
    tone,
    heading,
    detail,
    method,
    alpha,
    meansProvenance: typeof s.means_provenance === "string" ? s.means_provenance : null,
    scaleLabel: separation?.scale_label ?? null,
    separation: separation ?? null,
    showLetters,
    authoritative,
  };
}

// ── Supplementary all-cell separation ────────────────────────────────────────

export interface CellSeparationDisplay {
  rows: { factorALevel: string; factorBLevel: string; mean: number; group: string }[];
  factorALabel: string;
  factorBLabel: string;
  test: string;
  alpha: number | null;
  /** True when the interaction governs, so this table is descriptive only. */
  supplementary: boolean;
  scaleLabel: string;
  role: string | null;
  note: string;
}

/**
 * All-combination separation.
 *
 * When the interaction governs this is explicitly SUPPLEMENTARY: an all-cell
 * Tukey pools every comparison into one family, which is a different question
 * from "does Factor A differ within this level of Factor B" and is not a
 * substitute for simple-effects inference.
 */
export function describeCellSeparation(
  result: GeneticsResult,
  interactionGoverns: boolean
): CellSeparationDisplay | null {
  const sep = result.interaction_separation as Record<string, unknown> | null | undefined;
  if (!isPopulated(sep)) return null;
  const aLevels = asStringArray(sep.genotype);
  const bLevels = asStringArray(sep.factor);
  const means = Array.isArray(sep.mean) ? (sep.mean as unknown[]).map(Number) : [];
  const groups = asStringArray(sep.group);
  if (aLevels.length === 0) return null;

  return {
    rows: aLevels.map((a, i) => ({
      factorALevel: a,
      factorBLevel: bLevels[i] ?? "",
      mean: means[i],
      group: groups[i] ?? "",
    })),
    factorALabel: typeof sep.genotype_label === "string" ? sep.genotype_label : "Factor A",
    factorBLabel: typeof sep.factor_label === "string" ? sep.factor_label : "Factor B",
    test: typeof sep.test === "string" ? sep.test : "Tukey HSD",
    alpha: asNumber(sep.alpha),
    supplementary: interactionGoverns,
    scaleLabel: "Cell arithmetic mean",
    role: typeof sep.role === "string" ? sep.role : null,
    note: interactionGoverns
      ? "Supplementary and descriptive. All cells are compared in a single family, which is a different question from a simple effect — the governed simple-effects families above are the authoritative comparison."
      : "Cell arithmetic means across all treatment combinations.",
  };
}

// ── Interaction plot ─────────────────────────────────────────────────────────

export interface InteractionPlotSeries {
  label: string;
  xLevels: string[];
  means: number[];
  n: number[];
}

export interface InteractionPlotDisplay {
  xAxisFactor: string;
  lineFactor: string;
  yAxisLabel: string;
  xLevels: string[];
  series: InteractionPlotSeries[];
  scaleLabel: string;
  note: string;
}

/**
 * Read the governed interaction-plot contract.
 *
 * Descriptive only. Non-parallel lines can make an interaction pattern legible,
 * but significance comes from the interaction F-test — a plot cannot establish
 * it, and lines that merely look non-parallel prove nothing.
 */
export function readInteractionPlot(result: GeneticsResult): InteractionPlotDisplay | null {
  const plot = result.interaction_plot as Record<string, unknown> | null | undefined;
  if (!isPopulated(plot)) return null;
  const rawSeries = Array.isArray(plot.series) ? plot.series : [];
  const series: InteractionPlotSeries[] = rawSeries
    .map((s) => {
      if (!isPopulated(s)) return null;
      const item = s as Record<string, unknown>;
      return {
        label: String(item.factor_b_level ?? item.level ?? ""),
        xLevels: asStringArray(item.factor_a_levels),
        means: Array.isArray(item.mean) ? (item.mean as unknown[]).map(Number) : [],
        n: Array.isArray(item.n) ? (item.n as unknown[]).map(Number) : [],
      };
    })
    .filter((s): s is InteractionPlotSeries => s !== null && s.means.length > 0);
  if (series.length === 0) return null;

  return {
    xAxisFactor: typeof plot.x_axis_factor === "string" ? plot.x_axis_factor : "Factor A",
    lineFactor: typeof plot.line_factor === "string" ? plot.line_factor : "Factor B",
    yAxisLabel: typeof plot.y_axis_label === "string" ? plot.y_axis_label : "Mean",
    xLevels: asStringArray(plot.x_axis_levels),
    series,
    scaleLabel: typeof plot.scale_label === "string" ? plot.scale_label : "Cell arithmetic mean",
    note:
      typeof plot.note === "string"
        ? plot.note
        : "Non-parallel lines suggest the effect of one factor depends on the level of the other. Read this alongside the interaction F-test; the plot alone establishes nothing.",
  };
}

// ── Three-factor isolation ───────────────────────────────────────────────────

/**
 * Does this result carry three-factor output?
 *
 * Three-factor factorial is LIMITED / EXPERIMENTAL. Such a payload must not
 * crash the governed two-factor interface and must not be promoted into it.
 */
export function hasThreeFactorOutput(result: GeneticsResult | null | undefined): boolean {
  if (!result) return false;
  return (
    isPopulated(result.mean_separation_c) ||
    isPopulated(result.two_way_interaction_means) ||
    (typeof result.n_treatment_factors === "number" && result.n_treatment_factors >= 3)
  );
}
