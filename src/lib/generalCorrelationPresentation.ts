/**
 * REL-UI-02 — General Correlation presentation helpers (display only).
 *
 * Mirrors the verified Word report
 * (vivasense-backend genetics-module/general_relationship_export.py):
 * one p-value rule, the same significance states and markers, and the same
 * interpretation wording built from the structured pair results. Nothing
 * here computes or changes a statistic; stored values are never rounded.
 */

export type GeneralMethod = "pearson" | "spearman";

export interface PresentationPair {
  trait_1: string;
  trait_2: string;
  n: number | null;
  estimable: boolean;
  r: number | null;
  p_raw: number | null;
  p_adjusted: number | null;
  significant_raw?: boolean | null;
  significant_adjusted: boolean | null;
  strength?: string | null;
  direction?: string | null;
  flags?: string[] | null;
  reason?: string | null;
}

export type PairState = "significant" | "not_significant" | "not_assessed" | "not_estimable";

export const SIGNIFICANT_MARK = "*";
export const NOT_ASSESSED_MARK = "†";
export const NOT_ESTIMABLE_MARK = "—";

/** Four decimals; "< 0.0001" below that; "—" when not reported. */
export function formatP(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return NOT_ESTIMABLE_MARK;
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}

/** "= 0.0123" or "< 0.0001" inside a sentence. */
export function pPhrase(value: number | null | undefined): string {
  const text = formatP(value);
  return text.startsWith("<") ? text : `= ${text}`;
}

export function formatR(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NOT_ESTIMABLE_MARK;
  return value.toFixed(3).replace("-", "−");
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

export function pairState(p: PresentationPair): PairState {
  if (!p.estimable || p.r == null || !Number.isFinite(p.r)) return "not_estimable";
  // a missing or non-finite adjusted p is never shown as an ordinary test
  if (p.significant_adjusted == null || p.p_adjusted == null || !Number.isFinite(p.p_adjusted)) return "not_assessed";
  return p.significant_adjusted ? "significant" : "not_significant";
}

export function stateMark(p: PresentationPair): string {
  const s = pairState(p);
  return s === "significant" ? SIGNIFICANT_MARK : s === "not_assessed" ? NOT_ASSESSED_MARK : "";
}

export function significanceLabel(p: PresentationPair): string {
  return {
    significant: "significant",
    not_significant: "not significant",
    not_assessed: "not assessed",
    not_estimable: "not estimable",
  }[pairState(p)];
}

export function methodName(method: string): string {
  return method === "spearman" ? "Spearman rank" : "Pearson";
}

export function coefSymbol(method: string): string {
  return method === "spearman" ? "ρ" : "r";
}

export function sampleSizePhrase(pairs: PresentationPair[]): string {
  const ns = pairs.map((p) => p.n).filter((n): n is number => n != null);
  if (!ns.length) return "pairwise sample sizes not available";
  const lo = Math.min(...ns);
  const hi = Math.max(...ns);
  if (lo === hi) return ns.length > 1 ? `n = ${lo} for every pair` : `n = ${lo}`;
  return `pairwise n ranges from ${lo} to ${hi}`;
}

export function markerLegend(pairs: PresentationPair[], alpha: number, m: number | null | undefined): string {
  const states = new Set(pairs.map(pairState));
  const tests = m ? ` across ${plural(m, "test")}` : "";
  const parts = [
    `${SIGNIFICANT_MARK} FDR-adjusted p < ${alpha} (Benjamini–Hochberg${tests})`,
    "no marker: not significant after FDR adjustment",
  ];
  if (states.has("not_assessed"))
    parts.push(`${NOT_ASSESSED_MARK} significance not assessed (Spearman, pairwise n ≤ 10; coefficient descriptive only)`);
  if (states.has("not_estimable")) parts.push(`${NOT_ESTIMABLE_MARK} not estimable`);
  return `${parts.join("; ")}.`;
}

export interface InterpretationItem {
  label: string;
  state: PairState;
  text: string;
}

export interface StructuredInterpretation {
  summary: string;
  items: InterpretationItem[];
  closing: string;
}

/** Same statements as the engine's interpretation, as summary + one item per pair. */
export function buildInterpretation(
  traits: string[],
  method: string,
  alpha: number,
  pairs: PresentationPair[],
  multiplicity: { n_hypotheses?: number | null } | null | undefined,
): StructuredInterpretation {
  const sym = coefSymbol(method);
  const m = Number(multiplicity?.n_hypotheses ?? 0);
  const withheld = pairs.filter((p) => pairState(p) === "not_assessed").length;
  const notEst = pairs.filter((p) => pairState(p) === "not_estimable").length;
  const nSig = pairs.filter((p) => pairState(p) === "significant").length;

  let summary =
    `General correlation analysis examined ${plural(traits.length, "numeric variable")} ` +
    `(${plural(pairs.length, "variable pair")}) using ${methodName(method)} correlation ` +
    `on pairwise-complete observations (α = ${alpha}). `;
  if (m) {
    summary +=
      `${plural(m, "pair")} ${m === 1 ? "was" : "were"} tested; Benjamini–Hochberg ` +
      `false discovery rate (FDR) adjustment was applied across ` +
      `${m === 1 ? "this test" : `these ${m} tests`}, and statistical significance ` +
      `below refers to the FDR-adjusted p-value. ${plural(nSig, "pair")} ` +
      `${nSig === 1 ? "was" : "were"} significant after adjustment. `;
  } else {
    summary += "No pair was eligible for a significance test, so no FDR adjustment was applied. ";
  }
  if (withheld) {
    summary +=
      `For ${plural(withheld, "pair")}, Spearman p-values and significance decisions ` +
      "were withheld because pairwise n ≤ 10; " +
      `${withheld === 1 ? "its coefficient is" : "their coefficients are"} descriptive only. `;
  }
  if (notEst) summary += `${plural(notEst, "pair")} could not be estimated. `;
  summary +=
    "No genotype means, genetic variance components or model-based genetic correlations " +
    "were fitted in General Correlation mode.";

  const items: InterpretationItem[] = pairs.map((p) => {
    const label = `${p.trait_1} × ${p.trait_2}`;
    const state = pairState(p);
    if (state === "not_estimable") {
      return { label, state, text: `not estimated – ${p.reason || "insufficient data"}.` };
    }
    const core = `${sym} = ${formatR(p.r)} (${p.strength}, ${p.direction}), n = ${p.n}`;
    if (state === "not_assessed") {
      return {
        label,
        state,
        text:
          `${core}. Spearman p-values and significance decisions are withheld for small ` +
          "samples (pairwise n ≤ 10); this association is descriptive only.",
      };
    }
    let text = `${core}; raw p ${pPhrase(p.p_raw)}, FDR-adjusted p ${pPhrase(p.p_adjusted)}.`;
    if (state === "significant") {
      text += ` The data provide statistical evidence of a ${p.direction} association at α = ${alpha} after FDR adjustment.`;
    } else if (p.significant_raw) {
      text +=
        ` The raw p-value is below α = ${alpha}, but after adjustment for ` +
        `${m === 1 ? "the single test" : `the ${m} simultaneous tests`} the data did ` +
        "not provide sufficient evidence of a statistically detectable relationship.";
    } else {
      text +=
        " The data did not provide sufficient evidence of a statistically detectable " +
        `relationship at α = ${alpha}; this is not evidence that the variables are unrelated.`;
    }
    const flags = p.flags ?? [];
    if (flags.includes("small_n")) {
      text +=
        ` With only n = ${p.n} observations the estimate is imprecise` +
        (Math.abs(Number(p.r)) >= 0.5 ? "; a coefficient of this size can arise by chance in small samples" : "") +
        ", so treat it with caution.";
    }
    if (flags.includes("perfect_correlation")) text += " A perfect correlation usually indicates derived or duplicated variables.";
    return { label, state, text };
  });

  const closing =
    "Correlation describes statistical association only and does not establish causation. " +
    "Biological interpretation – mechanism, management or breeding relevance – requires " +
    "subject-matter judgement beyond these statistics.";
  return { summary, items, closing };
}

/** Design-layout column names excluded from the default variable list (exact, case-insensitive). */
export const DESIGN_COLUMN_NAMES = ["rep", "replication", "block", "plot", "row", "column"] as const;

export function isDesignColumn(name: string): boolean {
  return (DESIGN_COLUMN_NAMES as readonly string[]).includes(name.trim().toLowerCase());
}

export const DESIGN_COLUMN_WARNING =
  "Design variables such as replicate, block, plot, row or column numbers describe the layout of the experiment; they are not automatically quantitative traits. Include one only if its values are a meaningful measured quantity.";
