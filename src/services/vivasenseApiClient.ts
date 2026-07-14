import { API_BASE } from "./apiConfig";
import { buildModeHeaders } from "./featureMode";
import { requestWithResilience } from "./httpClient";

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
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
    return JSON.stringify(body);
  } catch {
    try {
      const text = await response.text();
      if (text) return text;
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
