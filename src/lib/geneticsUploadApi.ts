/**
 * API functions for VivaSense Genetics upload, analysis & correlation endpoints.
 */

import type {
  UploadPreviewResponse,
  AnalyzeUploadRequest,
  AnalyzeUploadResponse,
  CorrelationRequest,
  CorrelationResponse,
  AnalysisModule,
  RegisterDatasetRequest,
  RegisterDatasetResponse,
  GeneticParametersRequest,
  GeneticParametersResponse,
} from "@/types/geneticsUpload";

import { vivaSenseRequest } from "@/services/vivasenseApiClient";

export async function uploadPreview(file: File): Promise<UploadPreviewResponse> {
  const url = "/genetics/upload-preview";
  console.log("[MODULE] upload-preview");
  console.log("[REQUEST] upload-preview", url);
  const fd = new FormData();
  fd.append("file", file);
  return vivaSenseRequest<UploadPreviewResponse>(url, {
    method: "POST",
    body: fd,
    timeoutMs: 60000,
  });
}

export async function analyzeUpload(body: AnalyzeUploadRequest): Promise<AnalyzeUploadResponse> {
  const url = `/genetics/analyze-upload?module=${body.module}`;
  console.log("[MODULE]", body.module);
  console.log("[REQUEST] analyze-upload", url);
  return vivaSenseRequest<AnalyzeUploadResponse>(url, {
    method: "POST",
    jsonBody: body,
    timeoutMs: 180000,
  });
}

export async function computeAnova(body: {
  dataset_token?: string | null;
  trait_columns: string[];
}): Promise<Record<string, unknown>> {
  const url = "/analysis/anova";
  console.log("[MODULE] anova");
  console.log("[REQUEST] anova", url, body);
  return vivaSenseRequest<Record<string, unknown>>(url, {
    method: "POST",
    jsonBody: body,
  });
}

export async function computeCorrelation(body: CorrelationRequest): Promise<CorrelationResponse> {
  const url = "/genetics/correlation";
  console.log("[MODULE] correlation");
  console.log("[REQUEST] correlation", url);
  return vivaSenseRequest<CorrelationResponse>(url, {
    method: "POST",
    jsonBody: body,
  });
}

export async function computeGeneticParameters(body: {
  dataset_token?: string | null;
  trait_columns: string[];
}): Promise<Record<string, unknown>> {
  const url = "/analysis/genetic-parameters";
  console.log("[MODULE] genetic-parameters");
  console.log("[REQUEST] genetic-parameters", url, body);
  return vivaSenseRequest<Record<string, unknown>>(url, {
    method: "POST",
    jsonBody: body,
  });
}

/**
 * Register a confirmed column mapping and receive a dataset token whose cached
 * context carries it. Required before any /analysis/* call that depends on an
 * explicitly declared column role — those endpoints read roles from the token,
 * not from their own request body.
 */
export async function registerDataset(
  body: RegisterDatasetRequest
): Promise<RegisterDatasetResponse> {
  const url = "/upload/dataset";
  console.log("[MODULE] upload-dataset");
  console.log("[REQUEST] upload-dataset", url, { ...body, base64_content: "<omitted>" });
  return vivaSenseRequest<RegisterDatasetResponse>(url, {
    method: "POST",
    jsonBody: body,
    timeoutMs: 120000,
  });
}

/**
 * Variance components & heritability for one or more traits. The token must
 * already carry the declared genotype, replication and environment mapping.
 */
export async function computeVarianceComponents(
  body: GeneticParametersRequest
): Promise<GeneticParametersResponse> {
  const url = "/analysis/genetic-parameters";
  console.log("[MODULE] genetic-parameters");
  console.log("[REQUEST] genetic-parameters", url, body);
  return vivaSenseRequest<GeneticParametersResponse>(url, {
    method: "POST",
    jsonBody: body,
    timeoutMs: 180000,
  });
}

export async function computeRegression(body: {
  dataset_token: string;
  x_variable: string;
  y_variable: string;
  model_type?: string;
}): Promise<Record<string, unknown>> {
  const url = "/analysis/regression";
  console.log("[MODULE] regression");
  console.log("[REQUEST] regression", url, body);
  return vivaSenseRequest<Record<string, unknown>>(url, {
    method: "POST",
    jsonBody: { ...body, model_type: body.model_type ?? "linear" },
  });
}

export async function downloadReport(
  module: AnalysisModule,
  payload: Record<string, unknown>
): Promise<Blob> {
  const url = `/genetics/download-results?module=${module}`;
  console.log("[MODULE]", module);
  console.log("[REQUEST] download-results", url);
  return vivaSenseRequest<Blob>(url, {
    method: "POST",
    jsonBody: { ...payload, module },
    responseType: "blob",
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
