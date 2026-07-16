/**
 * Research Workspace — pure derivation of workflow state and the recommended
 * next action from REAL data (studies + analysis_history rows). No guessing:
 * every signal comes from data the caller fetched via existing services.
 */
import type { StudyWithProgress } from "@/types/dataCapture";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

export type StageStatus = "done" | "current" | "upcoming";

export type WorkspaceAction =
  | "create-study" | "field-layout" | "data-capture" | "start-analysis" | "advanced" | "dashboard";

export interface WorkflowStage {
  key: string;
  label: string;
  status: StageStatus;
}

export interface RecommendedAction {
  title: string;
  description: string;
  cta: string;
  action: WorkspaceAction;
}

const TRAIT_REL_TYPES = ["correlation", "trait_association", "path_analysis", "regression"];
const ADVANCED_TYPES = ["pca", "cluster", "blup", "stability", "selection_index"];

/** The canonical research pipeline (labels only; ordering is fixed). */
const PIPELINE: { key: string; label: string }[] = [
  { key: "study", label: "Study" },
  { key: "field-layout", label: "Field Layout" },
  { key: "field-book", label: "Field Book" },
  { key: "data-collection", label: "Data Collection" },
  { key: "dataset-upload", label: "Dataset Upload" },
  { key: "descriptive", label: "Descriptive Stats" },
  { key: "anova", label: "ANOVA" },
  { key: "trait-rel", label: "Trait Relationships" },
  { key: "advanced", label: "Advanced Analysis" },
  { key: "interpretation", label: "Interpretation" },
  { key: "report", label: "Report" },
];

export interface WorkspaceState {
  activeStudy: StudyWithProgress | null;
  studyCount: number;
  analysisCount: number;
  uniqueDatasets: number;
  stages: WorkflowStage[];
  recommended: RecommendedAction;
}

/** Derive everything the workspace header shows from real fetched data. */
export function deriveWorkspaceState(
  studies: StudyWithProgress[],
  analyses: AnalysisHistoryRecord[],
): WorkspaceState {
  const types = new Set(analyses.map((a) => a.analysis_type));
  const has = (t: string) => types.has(t);
  const hasAny = (list: string[]) => list.some((t) => types.has(t));

  const hasStudies = studies.length > 0;
  const hasAnalyses = analyses.length > 0;
  const uniqueDatasets = new Set(analyses.map((a) => a.dataset_name).filter(Boolean)).size;

  // Which pipeline stages have real evidence of completion.
  const done = new Set<string>();
  if (hasStudies) done.add("study");
  if (hasAnalyses) done.add("dataset-upload");
  if (has("anova")) { done.add("descriptive"); done.add("anova"); }
  if (hasAny(TRAIT_REL_TYPES)) done.add("trait-rel");
  if (hasAny(ADVANCED_TYPES)) done.add("advanced");

  // Recommended next action — first unmet step, in pipeline order.
  const recommended = recommend(hasStudies, hasAnalyses, has, hasAny);
  const currentKey = recommendedStageKey(recommended.action);

  const stages: WorkflowStage[] = PIPELINE.map((s) => ({
    key: s.key,
    label: s.label,
    status: done.has(s.key) ? "done" : s.key === currentKey ? "current" : "upcoming",
  }));

  return {
    activeStudy: studies[0] ?? null, // listStudiesWithProgress returns newest-first
    studyCount: studies.length,
    analysisCount: analyses.length,
    uniqueDatasets,
    stages,
    recommended,
  };
}

function recommend(
  hasStudies: boolean,
  hasAnalyses: boolean,
  has: (t: string) => boolean,
  hasAny: (l: string[]) => boolean,
): RecommendedAction {
  if (!hasStudies) {
    return { title: "Create your first study", description: "Organize your research before collecting or analyzing data.", cta: "Create Study", action: "create-study" };
  }
  if (!hasAnalyses) {
    return { title: "Run your first analysis", description: "Upload trial data and start with ANOVA to test treatment effects.", cta: "Start New Analysis", action: "start-analysis" };
  }
  if (!has("anova")) {
    return { title: "Run an ANOVA", description: "Test treatment effects and get mean separation on your trial.", cta: "Open ANOVA", action: "start-analysis" };
  }
  if (!hasAny(TRAIT_REL_TYPES)) {
    return { title: "Explore trait relationships", description: "Quantify correlations and trait associations across your data.", cta: "Open Advanced", action: "advanced" };
  }
  if (!hasAny(ADVANCED_TYPES)) {
    return { title: "Go deeper with advanced analysis", description: "Run PCA, clustering, BLUP or stability for multivariate insight.", cta: "Open Advanced", action: "advanced" };
  }
  return { title: "Review and report", description: "Your analyses look comprehensive — revisit results and export reports.", cta: "View Dashboard", action: "dashboard" };
}

function recommendedStageKey(action: WorkspaceAction): string {
  switch (action) {
    case "create-study": return "study";
    case "field-layout": return "field-layout";
    case "data-capture": return "data-collection";
    case "start-analysis": return "anova";
    case "advanced": return "advanced";
    case "dashboard": return "report";
    default: return "";
  }
}
