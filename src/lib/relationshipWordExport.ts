/**
 * REL-UI-01 Phase A — Word report for a quick (non-persisted) Relationship run.
 *
 * The backend seals every /genetics/correlation result (`result_integrity`)
 * and POST /export/correlation-word verifies that seal before rendering:
 *   - sealed and unmodified  → report states it was verified;
 *   - altered statistics     → 422 (integrity), nothing is rendered;
 *   - no seal                → rendered, but stamped UNVERIFIED.
 *
 * So the browser must send the backend response EXACTLY as received — no
 * normalisation, no dropped fields (pair_results, multiplicity, warnings,
 * analysis_context, …) and never a payload without its seal. A quick run is
 * not persisted: the report carries no dataset version or execution identity.
 */
import { vivaSenseRequest } from "@/services/vivasenseApiClient";

export const RELATIONSHIP_WORD_ENDPOINT = "/export/correlation-word";

export type RelationshipWordResult = Record<string, unknown>;

export function hasIntegritySeal(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const seal = (result as Record<string, unknown>).result_integrity;
  return Boolean(seal && typeof seal === "object" && !Array.isArray(seal));
}

/** The exact payload sent for export: a detached copy of the backend response. */
export function relationshipWordPayload(result: unknown): RelationshipWordResult {
  if (!hasIntegritySeal(result)) {
    throw new Error(
      "This result has no VivaSense integrity seal, so a verified Word report cannot be produced. Run the analysis again.",
    );
  }
  // JSON round trip == what fetch would send anyway; detaches from React state.
  return JSON.parse(JSON.stringify(result)) as RelationshipWordResult;
}

export function relationshipWordFilename(context: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  const ctx = context === "genetic" ? "genetic" : "general";
  return `vivasense_relationship_${ctx}_${stamp}.docx`;
}

export interface WordDownloadDeps {
  request?: typeof vivaSenseRequest;
  save?: (blob: Blob, filename: string) => void;
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

export async function downloadRelationshipWord(
  result: unknown,
  context: string,
  { request = vivaSenseRequest, save = saveBlob }: WordDownloadDeps = {},
): Promise<string> {
  const payload = relationshipWordPayload(result);
  const blob = await request<Blob>(RELATIONSHIP_WORD_ENDPOINT, {
    method: "POST",
    jsonBody: payload,
    responseType: "blob",
    timeoutMs: 180000,
  });
  const filename = relationshipWordFilename(context);
  save(blob, filename);
  return filename;
}
