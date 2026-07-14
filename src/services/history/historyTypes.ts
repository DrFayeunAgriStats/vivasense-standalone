/**
 * Research Analysis History — shared types (Phase 1).
 *
 * Frontend-only persistence layer (Supabase). The Railway backend is unaware
 * of this feature. No licensing/subscription state lives here — history is
 * available to every authenticated user.
 */

/** Canonical analysis-type identifiers stored in analysis_history.analysis_type. */
export type AnalysisTypeId =
  | "anova"
  | "genetic_parameters"
  | "correlation"
  | "regression"
  | "pca"
  | "cluster"
  | "blup"
  | "stability"
  | "path_analysis"
  | "selection_index";

/** A row as stored in / read from public.analysis_history. */
export interface AnalysisHistoryRecord {
  id: string;
  user_id: string;
  session_id: string | null;
  created_at: string;

  analysis_type: AnalysisTypeId | string;
  analysis_title: string | null;
  /** Optional user-defined study/project name grouping related analyses (future). */
  study_name: string | null;
  design_type: string | null;
  dataset_name: string | null;
  dataset_token: string | null;
  traits: string[] | null;

  analysis_status: "success";
  execution_time_ms: number | null;
  backend_endpoint: string | null;
  backend_version: string | null;
  frontend_version: string | null;

  institution: string | null;
  country: string | null;
  user_role: string | null;

  analysis_parameters: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  notes: string | null;
  favorite: boolean;
}

/** Insert payload — everything the DB fills in itself (id, created_at) is omitted. */
export type NewAnalysisHistoryRow = Omit<AnalysisHistoryRecord, "id" | "created_at">;

/**
 * What a call site passes to historyService.recordAnalysis(). Deliberately small:
 * reuses objects the analysis flow already has (datasetContext, request, response).
 */
export interface RecordAnalysisInput {
  analysisType: AnalysisTypeId;
  backendEndpoint: string;
  datasetName?: string | null;
  datasetToken?: string | null;
  designType?: string | null;
  traits?: string[] | null;
  /** Groups analyses of one dataset into a Research Session (future); optional now. */
  sessionId?: string | null;
  /** performance.now() captured immediately before the backend call. */
  startedAt?: number;
  parameters?: Record<string, unknown>;
  /** Raw backend response — used to derive result_summary. Never persisted whole. */
  response?: unknown;
  /** Optional explicit title; otherwise derived from type + dataset name. */
  title?: string | null;
  /** Optional study/project name (future grouping; not populated automatically yet). */
  studyName?: string | null;
}

/** Denormalized profile snapshot stored alongside each analysis. */
export interface ProfileSnapshot {
  institution: string | null;
  country: string | null;
  user_role: string | null;
}
