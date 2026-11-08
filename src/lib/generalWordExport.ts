/**
 * REL-UI-01 Phase A (Option B) — verified Word report for a General correlation.
 *
 * POST /export/correlation-word/general renders a report ONLY when the
 * backend's integrity seal on the posted result verifies and the result is a
 * General correlation; altered, unsealed or foreign-key payloads are refused
 * (422). The browser therefore sends the /genetics/correlation/general
 * response exactly as received, and never sends a result without a seal.
 */
import { vivaSenseRequest } from "@/services/vivasenseApiClient";

export const GENERAL_WORD_ENDPOINT = "/export/correlation-word/general";

export function hasIntegritySeal(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const seal = (result as Record<string, unknown>).result_integrity;
  return Boolean(seal && typeof seal === "object" && !Array.isArray(seal));
}

export function isGeneralResult(result: unknown): boolean {
  return Boolean(
    result &&
      typeof result === "object" &&
      (result as Record<string, unknown>).analysis_context === "general",
  );
}

/** Exact payload sent for export: a detached copy of the backend response. */
export function generalWordPayload(result: unknown): Record<string, unknown> {
  if (!isGeneralResult(result)) {
    throw new Error("Only a General correlation result can be exported as this report.");
  }
  if (!hasIntegritySeal(result)) {
    throw new Error(
      "This result has no VivaSense integrity seal, so a verified Word report cannot be produced. Run the analysis again.",
    );
  }
  return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
}

export function generalWordFilename(now: Date = new Date()): string {
  return `vivasense_general_correlation_${now.toISOString().slice(0, 10)}.docx`;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface GeneralWordDeps {
  request?: typeof vivaSenseRequest;
  save?: (blob: Blob, filename: string) => void;
}

export async function downloadGeneralWord(
  result: unknown,
  { request = vivaSenseRequest, save = saveBlob }: GeneralWordDeps = {},
): Promise<string> {
  const payload = generalWordPayload(result);
  const blob = await request<Blob>(GENERAL_WORD_ENDPOINT, {
    method: "POST",
    jsonBody: payload,
    responseType: "blob",
    timeoutMs: 180000,
  });
  const filename = generalWordFilename();
  save(blob, filename);
  return filename;
}
