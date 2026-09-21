import { supabase } from "@/integrations/supabase/client";
import { vivaSenseRequest } from "@/services/vivasenseApiClient";
import type { DatasetContext } from "@/types/geneticsUpload";
import type {
  AnalysisSettings,
  GeneticsResult,
  UploadAnalysisResponse,
} from "@/services/geneticsUploadApi";

export interface PersistentRcbdMetadata {
  study_id: string;
  dataset_id: string;
  dataset_version_id: string;
  analysis_run_id: string;
  prepare_outcome: string;
  run_outcome: string;
  run_status: string;
}

interface PrepareDatasetVersionResponse {
  outcome: string;
  dataset_version_id: string;
  status: string;
  raw_digest?: string | null;
  canonical_snapshot_digest?: string | null;
}

interface RunAnalysisResponse {
  outcome: string;
  analysis_run_id: string;
  run_status: string;
  result_payload?: Record<string, Record<string, unknown>> | null;
}

export interface PersistentRcbdRunInput {
  datasetContext: DatasetContext;
  treatmentColumn: string;
  repColumn: string;
  selectedTraits: string[];
  alpha: number;
}

const DATASET_CACHE_PREFIX = "vivasense:governed-rcbd-dataset:v1:";

function bytesFromBase64(base64: string): Uint8Array {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Text(value: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(value));
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session?.access_token || !session.user?.id) {
    throw new Error("Your session is no longer available. Sign in again before running the governed RCBD analysis.");
  }
  return session;
}

async function resolveActiveStudy(userId: string): Promise<{ id: string; title: string }> {
  const { data, error } = await supabase
    .from("studies")
    .select("id,title")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error("Create a study before running governed RCBD analysis so the durable result has an explicit study lineage.");
  }

  return { id: String(data.id), title: String(data.title ?? "Untitled study") };
}

async function ensureDatasetRow(input: {
  studyId: string;
  userId: string;
  datasetName: string;
  sourceDigest: string;
}): Promise<string> {
  const cacheKey = `${DATASET_CACHE_PREFIX}${input.studyId}:${input.sourceDigest}`;
  const cachedId = localStorage.getItem(cacheKey);

  if (cachedId) {
    const { data, error } = await supabase
      .from("datasets")
      .select("id,study_id")
      .eq("id", cachedId)
      .eq("study_id", input.studyId)
      .maybeSingle();
    if (!error && data?.id) return String(data.id);
    localStorage.removeItem(cacheKey);
  }

  const { data, error } = await supabase
    .from("datasets")
    .insert({
      study_id: input.studyId,
      user_id: input.userId,
      name: input.datasetName,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Dataset persistence did not return a dataset id.");

  const datasetId = String(data.id);
  localStorage.setItem(cacheKey, datasetId);
  return datasetId;
}

function canonicalTraitToGeneticsResult(canonical: Record<string, unknown>): GeneticsResult {
  return {
    ...(canonical as unknown as GeneticsResult),
    environment_mode: "single",
    n_environments: null,
  };
}

export function adaptPersistentRcbdResponse(
  payload: Record<string, Record<string, unknown>>,
  selectedTraits: string[],
  meta: PersistentRcbdMetadata,
): UploadAnalysisResponse {
  const traitResults: UploadAnalysisResponse["trait_results"] = {};
  const summary: UploadAnalysisResponse["summary_table"] = [];

  for (const trait of selectedTraits) {
    const canonical = payload[trait];
    if (!canonical) {
      throw new Error(`The governed AnalysisResult is missing the selected trait "${trait}".`);
    }

    const result = canonicalTraitToGeneticsResult(canonical);
    traitResults[trait] = {
      status: "success",
      analysis_result: {
        status: "SUCCESS",
        mode: "single",
        data_validation: { is_valid: true, warnings: [] },
        variance_warnings: { is_valid: true, warnings: [] },
        result,
        interpretation: "",
      },
      error: null,
      data_warnings: [],
    };
    summary.push({
      trait,
      grand_mean: typeof result.grand_mean === "number" ? result.grand_mean : undefined,
      status: "success",
    });
  }

  const first = traitResults[selectedTraits[0]]?.analysis_result?.result;
  const settings = (first as unknown as { analysis_settings?: AnalysisSettings } | undefined)?.analysis_settings;

  return {
    summary_table: summary,
    trait_results: traitResults,
    dataset_summary: {
      n_genotypes: Number(first?.n_genotypes ?? 0),
      n_reps: Number(first?.n_reps ?? 0),
      n_traits: selectedTraits.length,
      mode: "single",
    },
    failed_traits: [],
    analysis_settings: settings,
    module: "anova",
    evidence_level: "A",
    experimental_structure:
      (first?.rcbd_design_profile as Record<string, unknown> | undefined) ?? null,
    persistence: meta,
  } as UploadAnalysisResponse;
}

export async function runPersistentRcbdAnalysis(
  input: PersistentRcbdRunInput,
): Promise<UploadAnalysisResponse> {
  if (!input.treatmentColumn || !input.repColumn) {
    throw new Error("Governed RCBD requires distinct treatment and block columns.");
  }
  if (input.treatmentColumn === input.repColumn) {
    throw new Error("A column cannot hold both treatment and block roles in the same RCBD model.");
  }
  if (input.selectedTraits.length === 0) {
    throw new Error("Select at least one response variable.");
  }

  const session = await requireSession();
  const study = await resolveActiveStudy(session.user.id);
  const rawBytes = bytesFromBase64(input.datasetContext.base64Content);
  const sourceDigest = await sha256Hex(rawBytes);

  const datasetId = await ensureDatasetRow({
    studyId: study.id,
    userId: session.user.id,
    datasetName: input.datasetContext.file.name,
    sourceDigest,
  });

  const prepareKey = `frontend-rcbd-v1:dv:${datasetId}:${sourceDigest}`;
  const prepared = await vivaSenseRequest<PrepareDatasetVersionResponse>(
    "/persistence/dataset-versions/prepare",
    {
      method: "POST",
      authToken: session.access_token,
      timeoutMs: 180000,
      jsonBody: {
        dataset_id: datasetId,
        idempotency_key: prepareKey,
        base64_content: input.datasetContext.base64Content,
        file_type: input.datasetContext.fileType,
        original_filename: input.datasetContext.file.name,
      },
    },
  );

  if (prepared.status !== "READY") {
    throw new Error(`DatasetVersion did not reach READY state (status=${prepared.status}).`);
  }

  const runIdentity = await sha256Text(
    JSON.stringify({
      study_id: study.id,
      dataset_version_id: prepared.dataset_version_id,
      genotype_column: input.treatmentColumn,
      rep_column: input.repColumn,
      selected_traits: input.selectedTraits,
      alpha: input.alpha,
      module: "anova",
      mode: "single",
      request_contract_schema_version: "v1",
    }),
  );

  const executed = await vivaSenseRequest<RunAnalysisResponse>(
    "/persistence/analysis-runs/execute",
    {
      method: "POST",
      authToken: session.access_token,
      timeoutMs: 240000,
      jsonBody: {
        study_id: study.id,
        dataset_version_id: prepared.dataset_version_id,
        idempotency_key: `frontend-rcbd-v1:run:${runIdentity}`,
        genotype_column: input.treatmentColumn,
        rep_column: input.repColumn,
        selected_traits: input.selectedTraits,
        response_semantics: {},
        alpha: input.alpha,
        module: "anova",
        mode: "single",
        request_contract_schema_version: "v1",
      },
    },
  );

  if (executed.run_status !== "COMPLETE" || !executed.result_payload) {
    throw new Error(
      `Governed AnalysisRun did not reach COMPLETE state (status=${executed.run_status}).`
    );
  }

  const meta: PersistentRcbdMetadata = {
    study_id: study.id,
    dataset_id: datasetId,
    dataset_version_id: prepared.dataset_version_id,
    analysis_run_id: executed.analysis_run_id,
    prepare_outcome: prepared.outcome,
    run_outcome: executed.outcome,
    run_status: executed.run_status,
  };

  return adaptPersistentRcbdResponse(executed.result_payload, input.selectedTraits, meta);
}


export async function exportPersistentRcbdReport(
  analysisRunId: string,
  filename = "VivaSense_ANOVA_rcbd.docx",
): Promise<void> {
  const session = await requireSession();
  const blob = await vivaSenseRequest<Blob>(
    `/persistence/analysis-runs/${analysisRunId}/report?domain=plant_breeding`,
    {
      method: "GET",
      authToken: session.access_token,
      timeoutMs: 180000,
      responseType: "blob",
    },
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
