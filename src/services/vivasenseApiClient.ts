import { API_BASE } from "./apiConfig";
import { buildModeHeaders } from "./featureMode";
import { requestWithResilience } from "./httpClient";
import { messageFromErrorBody } from "@/components/vivasense/genetics-params/feBeta02";

export type ResponseType = "json" | "blob" | "text";

export interface VivaSenseRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: BodyInit | null;
  jsonBody?: unknown;
  headers?: HeadersInit;
  timeoutMs?: number;
  retries?: number;
  responseType?: ResponseType;
  authToken?: string;
}

function resolveUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_BASE}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function buildHeaders(options: VivaSenseRequestOptions, isJsonBody: boolean): Headers {
  const base = buildModeHeaders(options.headers);
  if (options.authToken) {
    base.set("Authorization", `Bearer ${options.authToken}`);
  }
  if (isJsonBody) {
    base.set("Content-Type", "application/json");
  }
  return base;
}

async function extractErrorDetail(response: Response): Promise<string> {
  // Structured bodies (detail.message, 422 arrays) become readable text; raw
  // JSON is never shown to the researcher.
  try {
    const body = await response.json();
    return messageFromErrorBody(body, response.status);
  } catch {
    try {
      const text = await response.text();
      if (text) return messageFromErrorBody(text, response.status);
    } catch {
      // ignore
    }
    return `HTTP ${response.status} ${response.statusText}`;
  }
}

export async function vivaSenseRequest<T = unknown>(
  pathOrUrl: string,
  options: VivaSenseRequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const isJsonBody = options.jsonBody !== undefined;
  const body = isJsonBody ? JSON.stringify(options.jsonBody) : (options.body ?? null);
  const headers = buildHeaders(options, isJsonBody);

  const response = await requestWithResilience(resolveUrl(pathOrUrl), {
    method,
    headers,
    body,
    timeoutMs: options.timeoutMs ?? 120000,
    retries: options.retries ?? 0,
  });

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    throw new Error(detail);
  }

  const responseType = options.responseType ?? "json";
  if (responseType === "blob") return (await response.blob()) as T;
  if (responseType === "text") return (await response.text()) as T;
  return (await response.json()) as T;
}
