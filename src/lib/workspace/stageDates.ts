/**
 * Dates shown in the workflow are latest recorded analysis-history timestamps,
 * NOT action completion dates. A session-only result may have no persisted event.
 * Upload and field-work timestamps are not available and are deliberately omitted.
 */
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

const TRAIT_REL_TYPES = ["correlation", "trait_association", "path_analysis", "regression"];
const ADVANCED_TYPES = ["pca", "cluster", "blup", "stability", "selection_index"];

function latest(analyses: AnalysisHistoryRecord[], pred: (a: AnalysisHistoryRecord) => boolean): string | undefined {
  let best: string | undefined;
  for (const item of analyses) {
    if (!pred(item) || !item.created_at || !Number.isFinite(Date.parse(item.created_at))) continue;
    if (!best || Date.parse(item.created_at) > Date.parse(best)) best = item.created_at;
  }
  return best;
}
export function deriveStageDates(analyses: AnalysisHistoryRecord[]): Record<string, string | undefined> {
  return {
    anova: latest(analyses, a => a.analysis_type === "anova"),
    "trait-rel": latest(analyses, a => TRAIT_REL_TYPES.includes(a.analysis_type)),
    advanced: latest(analyses, a => ADVANCED_TYPES.includes(a.analysis_type)),
  };
}
