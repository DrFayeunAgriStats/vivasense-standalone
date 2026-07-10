/**
 * VivaSense Free vs Pro gating
 * -----------------------------------------------------------------
 * Centralizes the rules that decide whether a given analysis request
 * can run in Free Mode or requires the Pro tier.
 */

import { getVivaSenseMode } from "@/services/featureMode";

export type ProGuardKey =
  | "anova_combined"
  | "anova_multi_environment"
  | "anova_gxe"
  | "genetic_parameters"
  | "pca"
  | "clustering"
  | "path_analysis"
  | "selection_index"
  | "export_word"
  | "ai_interpretation_advanced";

export interface ProGuardInfo {
  key: ProGuardKey;
  name: string;
  category: string;
}

const PRO_GUARDS: Record<ProGuardKey, ProGuardInfo> = {
  anova_combined: { key: "anova_combined", name: "Combined ANOVA", category: "ANOVA" },
  anova_multi_environment: { key: "anova_multi_environment", name: "Multi-Environment ANOVA", category: "ANOVA" },
  anova_gxe: { key: "anova_gxe", name: "G×E Analysis", category: "ANOVA" },
  genetic_parameters: { key: "genetic_parameters", name: "Genetic Parameters", category: "Genetics" },
  pca: { key: "pca", name: "PCA / Multivariate", category: "Advanced" },
  clustering: { key: "clustering", name: "Clustering", category: "Advanced" },
  path_analysis: { key: "path_analysis", name: "Path Analysis", category: "Advanced" },
  selection_index: { key: "selection_index", name: "Selection Index / MGIDI", category: "Advanced" },
  export_word: { key: "export_word", name: "Word Export", category: "Export" },
  ai_interpretation_advanced: { key: "ai_interpretation_advanced", name: "Advanced AI Interpretation", category: "AI" },
};

export const getProGuardInfo = (key: ProGuardKey): ProGuardInfo => PRO_GUARDS[key];

export function classifyAnovaRequest(analysisType: string): "free" | "pro" {
  const freeTypes = ["anova_oneway", "anova_oneway_rcbd", "anova_twoway", "anova_rcbd_factorial", "anova_splitplot"];
  return freeTypes.includes(analysisType) ? "free" : "pro";
}

export function classifyGeneticsRequest(analysisType: string): "free" | "pro" {
  return analysisType === "correlations" ? "free" : "pro";
}

export const isProMode = (): boolean => getVivaSenseMode() === "pro";
