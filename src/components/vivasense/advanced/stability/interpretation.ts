// Display rules that keep every stability screen, badge, tooltip, chart legend and CSV consistent with the scientific status of the results:
// the Eberhart–Russell classes are EXPLORATORY and PROVISIONAL, a non-rejected test is not evidence of stability or equivalence, and a
// combined ranking is an aggregation of descriptive ranks, not a test.  Pure functions (no React) so that they can be unit-tested directly.
import type { StabilityResponse, StabilityRow } from "@/types/advancedAnalysis";

export const EXPLORATORY_STATUS = "exploratory_provisional";

export const NO_EQUIVALENCE_NOTE =
  "No equivalence test was performed: failing to reject b = 1 or S²d = 0 is absence of evidence of deviation, not evidence that b = 1, that the genotype is stable, or that it is equivalent to the average genotype.";

export const RANKING_TITLE = "Exploratory combined stability rankings";
export const RANKING_EXPLANATION =
  "Each genotype's rank is averaged over the methods that produced a rank for it (equal weights; no weighting was chosen). This is an aggregation of descriptive rankings, not a significance test, and it does not show that any genotype is stable. Methods measure different things (Eberhart–Russell S²d, Shukla variance, AMMI stability value, GGE distance), so read the combined rank together with the agreement between methods.";

export interface FlagDisplay {
  label: string;
  /** neutral = grey badge; flagged = a coloured exploratory flag; unknown = metadata missing, fail-safe */
  tone: "neutral" | "flagged" | "unknown";
  title: string;
  provisional: boolean;
}

/** True only when the payload says the classification is exploratory and provisional. */
export function hasProvisionalMetadata(r: Pick<StabilityRow, "classification_status" | "stability_class_label">): boolean {
  return r.classification_status === EXPLORATORY_STATUS && typeof r.stability_class_label === "string" && r.stability_class_label.trim() !== "";
}

/**
 * The exploratory flag of one genotype.  FAIL-SAFE: if the provisional metadata is absent (a legacy or partial payload), the class identifier is NOT
 * shown as a result -- in particular "stable" is never displayed unqualified.  The only class that needs no qualification is "not_classified".
 */
export function flagDisplay(r: Pick<StabilityRow, "stability_class" | "classification_status" | "stability_class_label" | "stability_description" | "b_inference_status">): FlagDisplay {
  if (r.stability_class === "not_classified") {
    return { label: r.stability_class_label?.trim() || "not classified (tests unavailable or numerically indeterminate)", tone: "neutral",
             title: r.stability_description ?? "Not classified.", provisional: true };
  }
  if (!hasProvisionalMetadata(r)) {
    return { label: "classification not shown (provisional status missing from the result)", tone: "unknown",
             title: "The result does not state that this classification is exploratory and provisional, so it is not displayed as a stability result. " + NO_EQUIVALENCE_NOTE,
             provisional: false };
  }
  // exact fit: the description already states that the b test was not performed and that the slope comparison is deterministic; the generic
  // "failing to reject" note would wrongly imply a test result for b, so it is not appended
  const exact = r.b_inference_status === "exact_fit";
  return { label: r.stability_class_label as string, tone: r.stability_class === "stable" ? "neutral" : "flagged",
           title: exact ? (r.stability_description ?? "") : (r.stability_description ?? "") + " " + NO_EQUIVALENCE_NOTE, provisional: true };
}

export interface RankRow {
  genotype: string;
  mean: number | null;
  er_flag: string;
  er_rank: number | null;
  shukla_rank: number | null;
  asv_rank: number | null;
  gge_rank: number | null;
  n_methods: number;
  /** mean of the available ranks; null when no method produced a rank */
  combined_rank: number | null;
}

/** Equal-weight mean of the ranks that exist.  Genotypes with no rank at all get combined_rank = null and sort last (never Infinity in a display or export). */
export function combinedRankings(result: StabilityResponse): RankRow[] {
  const geno = new Set<string>();
  result.genotype_stability?.forEach((g) => geno.add(g.genotype));
  result.ammi_results?.stability_measure?.forEach((g) => geno.add(g.genotype));
  result.gge_results?.mean_vs_stability?.genotype_distances?.forEach((g) => geno.add(g.genotype));
  const er = new Map<string, number>(), sh = new Map<string, number>(), asv = new Map<string, number>(), gge = new Map<string, number>();
  const mean = new Map<string, number>(), flag = new Map<string, string>();
  result.genotype_stability?.forEach((g) => {
    if (g.rank_s2di != null) er.set(g.genotype, g.rank_s2di);
    if (g.rank_shukla != null) sh.set(g.genotype, g.rank_shukla);
    mean.set(g.genotype, g.mean);
    flag.set(g.genotype, flagDisplay(g).label);
  });
  result.ammi_results?.stability_measure?.forEach((g) => asv.set(g.genotype, g.rank));
  result.gge_results?.mean_vs_stability?.genotype_distances?.forEach((g) => gge.set(g.genotype, g.rank));
  const rows: RankRow[] = Array.from(geno).map((g) => {
    const ranks = [er.get(g), sh.get(g), asv.get(g), gge.get(g)].filter((v): v is number => typeof v === "number");
    return { genotype: g, mean: mean.get(g) ?? null, er_flag: flag.get(g) ?? "—", er_rank: er.get(g) ?? null, shukla_rank: sh.get(g) ?? null,
             asv_rank: asv.get(g) ?? null, gge_rank: gge.get(g) ?? null, n_methods: ranks.length,
             combined_rank: ranks.length ? ranks.reduce((s, v) => s + v, 0) / ranks.length : null };
  });
  rows.sort((a, b) => (a.combined_rank ?? Number.POSITIVE_INFINITY) - (b.combined_rank ?? Number.POSITIVE_INFINITY));
  return rows;
}

/** Columns of the combined-ranking CSV: wording identical to the screen. */
export function rankingCsvRows(rows: RankRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    genotype: r.genotype, mean: r.mean, exploratory_flag_provisional: r.er_flag, rank_eberhart_russell_s2di: r.er_rank, rank_shukla: r.shukla_rank,
    rank_ammi_asv: r.asv_rank, rank_gge: r.gge_rank, methods_with_a_rank: r.n_methods, exploratory_combined_rank_equal_weights: r.combined_rank,
    note: "Aggregation of descriptive ranks; not a significance test; not evidence of stability.",
  }));
}

/** Text of the b p-value cell: a withheld value is explained, never shown as 0 or blank without reason. */
export function pCellText(p: number | null | undefined, status: string | null | undefined, fmt: (v: number, d: number) => string): string {
  if (p != null) return fmt(p, 3);
  if (status === "exact_fit") return "exact fit: no test";
  if (status === "indeterminate") return "indeterminate";
  return "—";
}

/** CSV rows of the classic table.  The class identifier is kept for API compatibility but is replaced by "not_shown" when the provisional metadata is missing. */
export function classicCsvRows(rows: StabilityRow[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const f = flagDisplay(r);
    return { ...r, stability_class: f.tone === "unknown" ? "not_shown" : r.stability_class, exploratory_flag_provisional: f.label,
             classification_status: r.classification_status ?? "missing", note: "Exploratory and provisional; not evidence of stability or equivalence." };
  });
}
