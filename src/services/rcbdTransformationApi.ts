/**
 * VivaSense RCBD Governed Transformation API Client
 * =================================================
 * The three governed routes behind the frozen RCBD v1 transformation workflow:
 *
 *   POST /genetics/rcbd/transformation-exploration      – explore candidates
 *   POST /genetics/rcbd/select-transformed-analysis     – adopt one for inference
 *   POST /genetics/rcbd/export-selected-transformed-word – export the selected branch
 *
 * Note the `/genetics` prefix: the routers are mounted with it, so the paths
 * are `/genetics/rcbd/...`, not `/rcbd/...`.
 *
 * The workflow is deliberately three separate calls. Exploration is explicitly
 * NOT inference — its response carries `authority:
 * "exploratory_not_selected_for_inference"` — and a transformed analysis only
 * becomes authoritative when the user selects it, which is why selection
 * requires `user_selected: true` plus the exact `model_frame_identity` of the
 * branch being adopted. That identity is what stops a transformed report being
 * built from a different model frame than the one the user reviewed.
 *
 * Phase A wires the clients only; no UI calls them yet.
 */

import { API_BASE } from "./apiConfig";
import { buildModeHeaders, guardProModule } from "./featureMode";
import { requestWithResilience } from "./httpClient";

const ENGINE_BASE: string = API_BASE;

/** Mirrors `InferentialAlpha = Literal[0.01, 0.05, 0.1]`. */
export type InferentialAlpha = 0.01 | 0.05 | 0.1;

export type EligibilityStatus =
  | "eligible_for_future_selection"
  | "ineligible_for_selection";

/** Per-trait scientific meaning; never inferred from numeric range. */
export interface ResponseMetadata {
  response_type:
    | "unknown"
    | "continuous"
    | "proportion_percentage"
    | "count"
    | "binary_binomial"
    | "rating_index";
  unit?: string | null;
  declared_scale?: string | null;
  numerator_column?: string | null;
  denominator_column?: string | null;
}

// ── 1. Exploration ───────────────────────────────────────────────────────────

export interface ExplorationRequest {
  analysis_token: string;
  trait: string;
  /** Backend rejects anything but true — exploration must be user-initiated. */
  user_initiated: true;
  inferential_alpha: InferentialAlpha;
  /** Must contain exactly the requested trait, or the backend rejects it. */
  response_metadata: Record<string, ResponseMetadata>;
}

export interface ExplorationResponse {
  transformed_branch_token: string;
  raw_analysis_token: string;
  dataset_token: string;
  module: "anova";
  trait: string;
  original_trait: string;
  sanitized_trait: string;
  design: "rcbd";
  inferential_alpha: InferentialAlpha;
  model_frame_identity: string;
  eligibility_status: EligibilityStatus;
  eligibility_reasons: string[];
  authority: "exploratory_not_selected_for_inference";
  exploration_available: boolean;
  user_initiated: true;
  not_selected_for_inference: true;
  response_semantics: ResponseMetadata;
  raw_reference: Record<string, unknown>;
  candidate: Record<string, unknown>;
  transformed_evidence: Record<string, unknown>;
  provenance: Record<string, unknown>;
}

// ── 2. Selection ─────────────────────────────────────────────────────────────

export interface SelectTransformedAnalysisRequest {
  raw_analysis_token: string;
  transformed_branch_token: string;
  trait: string;
  inferential_alpha: InferentialAlpha;
  /** `sha256:<64 hex>` — the exact frame the user reviewed. */
  model_frame_identity: string;
  user_selected: true;
  selection_action: "Use this transformed analysis for inferential reporting";
  diagnostic_concern_acknowledged?: boolean;
  /** Required whenever diagnostic_concern_acknowledged is true. */
  diagnostic_concern_acknowledgement?: string | null;
}

export interface SelectedTransformedAnalysis {
  selected_analysis_token: string;
  parent_raw_analysis_token: string;
  parent_transformed_branch_token: string;
  dataset_token: string;
  model_frame_identity: string;
  trait: string;
  original_trait: string;
  sanitized_trait: string;
  response_semantics: ResponseMetadata;
  inferential_alpha: InferentialAlpha;
  diagnostic_alpha: number;
  authority_state: "transformed_selected_for_inference";
  previous_authority_state: "transformed_explored_not_selected";
  transformation: Record<string, unknown>;
  model_contract: Record<string, unknown>;
  transformed_anova: Record<string, unknown>;
  treatment_decision: Record<string, unknown>;
  residual_ms: number;
  residual_df: number;
  tukey_result?: Record<string, unknown> | null;
  tukey_status: Record<string, unknown>;
  transformed_scale_estimates: Record<string, unknown>[];
  back_transformed_estimates: Record<string, unknown>[];
  transformed_diagnostics: Record<string, unknown>;
  effective_n: number;
  observation_accounting: Record<string, unknown>;
  warnings: string[];
  acknowledgements: string[];
  interpretation: string;
  created_at: string;
  selected_at: string;
  version_provenance: Record<string, unknown>;
  selected_report_contract_version: "phase_3b2_selected_report_v1";
}

// ── 3. Selected-branch export ────────────────────────────────────────────────

export interface SelectedReportRequest {
  selected_analysis_token: string;
}

// ── Transport ────────────────────────────────────────────────────────────────

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const url = `${ENGINE_BASE}${path}`;
  let response: Response;
  try {
    response = await requestWithResilience(url, {
      method: "POST",
      headers: buildModeHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      timeoutMs,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error calling ${path}: ${msg}`);
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const parsed = (await response.json()) as { detail?: unknown };
      if (parsed?.detail) detail = String(parsed.detail);
    } catch {
      /* non-JSON error body — keep the status line */
    }
    throw new Error(`${path} failed — ${detail}`);
  }
  return (await response.json()) as T;
}

export const RCBD_TRANSFORMATION_EXPLORATION_PATH =
  "/genetics/rcbd/transformation-exploration";
export const RCBD_SELECT_TRANSFORMED_ANALYSIS_PATH =
  "/genetics/rcbd/select-transformed-analysis";
export const RCBD_EXPORT_SELECTED_TRANSFORMED_WORD_PATH =
  "/genetics/rcbd/export-selected-transformed-word";

/** Explore Box-Cox candidates for one trait. Exploratory only — not inference. */
export function exploreRcbdTransformation(
  request: ExplorationRequest
): Promise<ExplorationResponse> {
  return postJson<ExplorationResponse>(
    RCBD_TRANSFORMATION_EXPLORATION_PATH,
    request,
    180000
  );
}

/** Adopt an explored transformed branch as the authoritative inference. */
export function selectRcbdTransformedAnalysis(
  request: SelectTransformedAnalysisRequest
): Promise<SelectedTransformedAnalysis> {
  return postJson<SelectedTransformedAnalysis>(
    RCBD_SELECT_TRANSFORMED_ANALYSIS_PATH,
    request,
    180000
  );
}

/**
 * Download the Word report for a selected transformed analysis.
 * Pro-gated like every other export; returns the blob for the caller to save.
 */
export async function exportSelectedTransformedWord(
  request: SelectedReportRequest
): Promise<Blob> {
  guardProModule("export-word");
  const url = `${ENGINE_BASE}${RCBD_EXPORT_SELECTED_TRANSFORMED_WORD_PATH}`;
  let response: Response;
  try {
    response = await requestWithResilience(url, {
      method: "POST",
      headers: buildModeHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(request),
      timeoutMs: 180000,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error during transformed Word export: ${msg}`);
  }
  if (!response.ok) {
    throw new Error(
      `Selected transformed Word export failed — HTTP ${response.status}`
    );
  }
  return await response.blob();
}
