/**
 * Early Access compatibility layer.
 * Commercial tiers are disabled; legacy mode values remain only for
 * caller/header compatibility. Scientific validation is elsewhere.
 */
export type VivaSenseMode = "free" | "pro";
const STORAGE_KEY = "vivasense_mode";
const MODE_CHANGE_EVENT = "vivasense:mode-change";

export function getVivaSenseMode(): VivaSenseMode { return "pro"; }

export function setVivaSenseMode(_mode: VivaSenseMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "pro");
    window.dispatchEvent(new CustomEvent(MODE_CHANGE_EVENT, { detail: "pro" }));
  } catch { /* storage may be unavailable */ }
}

export function subscribeVivaSenseMode(cb: (mode: VivaSenseMode) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onMode = () => cb("pro");
  window.addEventListener(MODE_CHANGE_EVENT, onMode);
  window.addEventListener("storage", onMode);
  return () => {
    window.removeEventListener(MODE_CHANGE_EVENT, onMode);
    window.removeEventListener("storage", onMode);
  };
}

export type ProGuardKey =
  | "anova_combined" | "anova_multi_environment" | "anova_gxe"
  | "genetic_parameters" | "pca" | "path_analysis" | "clustering"
  | "selection_index" | "stability" | "ammi" | "gge" | "molecular"
  | "regression" | "export_word" | "advanced_interpretation";

export interface ProGuardInfo {
  key: ProGuardKey;
  title: string;
  description: string;
}

const TITLES: Record<ProGuardKey, string> = {
  anova_combined: "Combined ANOVA",
  anova_multi_environment: "Multi-environment ANOVA",
  anova_gxe: "Genotype × Environment Analysis",
  genetic_parameters: "Genetic Parameters & Heritability",
  pca: "Principal Component Analysis",
  path_analysis: "Path Analysis",
  clustering: "Cluster Analysis",
  selection_index: "Selection Index / MGIDI",
  stability: "Stability Analysis",
  ammi: "AMMI Analysis",
  gge: "GGE Biplot",
  molecular: "Molecular Marker Analysis",
  regression: "Multiple Regression",
  export_word: "Word Export",
  advanced_interpretation: "Advanced AI Interpretation",
};

export const getProGuardInfo = (key: ProGuardKey): ProGuardInfo => ({
  key,
  title: TITLES[key],
  description: "Available during Early Access.",
});

export function classifyAnovaRequest(
  _analysisType: string,
  _formData: FormData,
): ProGuardInfo | null { return null; }

export function classifyGeneticsRequest(
  _analysisType: string,
): ProGuardInfo | null { return null; }

export const isProMode = (): boolean => true;
