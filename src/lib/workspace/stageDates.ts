/**
 * Per-stage completion dates for the Workspace V3 stepper — derived ONLY from
 * real timestamps that exist in fetched data. Stages without a trustworthy
 * timestamp (field layout, field book, data collection, descriptive, …) return
 * undefined, and the stepper omits the date rather than inventing one.
 *
 * The only reliable per-stage timestamps today are analysis_history.created_at
 * values. A full per-step audit trail (a timestamp when each workflow step was
 * actually completed) does not exist in the data model — see the V3 report's
 * "flagged backend gaps".
 */
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

const TRAIT_REL_TYPES = ["correlation", "trait_association", "path_analysis", "regression"];
const ADVANCED_TYPES = ["pca", "cluster", "blup", "stability", "selection_index"];

function earliest(
  analyses: AnalysisHistoryRecord[],
  pred: (a: AnalysisHistoryRecord) => boolean,
): string | undefined {
  let min: string | undefined;
  for (const a of analyses) {
    if (!pred(a) || !a.created_at) continue;
    if (min === undefined || a.created_at < min) min = a.created_at;
  }
  return min;
}

/**
 * Map of stage key → ISO completion date, for stages we can date honestly.
 * Keys absent from the map (or mapped to undefined) render with no date.
 */
export function deriveStageDates(analyses: AnalysisHistoryRecord[]): Record<string, string | undefined> {
  const anyAnalysis = earliest(analyses, () => true);
  return {
    // Any recorded analysis is evidence a dataset was uploaded.
    "dataset-upload": anyAnalysis,
    anova: earliest(analyses, (a) => a.analysis_type === "anova"),
    "trait-rel": earliest(analyses, (a) => TRAIT_REL_TYPES.includes(a.analysis_type)),
    advanced: earliest(analyses, (a) => ADVANCED_TYPES.includes(a.analysis_type)),
  };
}
