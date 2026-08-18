/**
 * Crop Protection Analytics API service.
 *
 * The only backend surface this module talks to is
 *   POST /crop-protection/bioassay/analyze
 * routed through vivaSenseRequest, so base URL, Pro/mode headers, auth,
 * error extraction and JSON handling all follow existing VivaSense conventions.
 *
 * UI components must not call fetch or build backend URLs directly.
 */

import { vivaSenseRequest } from "./vivasenseApiClient";
import type {
  BioassayAnalysisRequest,
  BioassayAnalysisResponse,
} from "@/types/cropProtection";

const BIOASSAY_ANALYZE_PATH = "/crop-protection/bioassay/analyze";

/**
 * The shared http client owns its own AbortController (it needs one for the
 * timeout), so a caller-supplied signal cannot reach fetch. Rather than change
 * shared transport for one module, superseded runs are dropped here: the panel
 * also blocks duplicate submissions, so this only matters if a component
 * remounts mid-flight.
 */
let inFlightToken = 0;

export class SupersededAnalysisError extends Error {
  constructor() {
    super("A newer analysis request replaced this one.");
    this.name = "SupersededAnalysisError";
  }
}

/**
 * Run the crop-protection factorial-CRD bioassay workflow.
 *
 * Errors arrive as Error(message) with the backend's `detail` already
 * extracted by vivaSenseRequest. The 501 path returns a structured detail
 * object ({code, message}); it is flattened to its message here so callers
 * never render a serialized object at the researcher.
 */
export async function analyzeBioassay(
  request: BioassayAnalysisRequest
): Promise<BioassayAnalysisResponse> {
  const token = ++inFlightToken;
  console.log("[MODULE] crop-protection-bioassay");
  console.log("[REQUEST] bioassay-analyze", BIOASSAY_ANALYZE_PATH, {
    ...request,
    dataset: { ...request.dataset, base64_content: "<omitted>" },
  });

  try {
    const response = await vivaSenseRequest<BioassayAnalysisResponse>(
      BIOASSAY_ANALYZE_PATH,
      {
        method: "POST",
        jsonBody: request,
        // The R factorial adapter runs one subprocess per response, and
        // co-toxicity adds a bootstrap; give it the same headroom the
        // multi-trait genetics analyses get.
        timeoutMs: 300000,
      }
    );
    if (token !== inFlightToken) throw new SupersededAnalysisError();
    return response;
  } catch (error) {
    if (token !== inFlightToken) throw new SupersededAnalysisError();
    throw new Error(readableBackendError(error));
  }
}

/**
 * Turn a transport/validation failure into something a researcher can act on.
 * Never surfaces a stack trace or a raw serialized object.
 */
export function readableBackendError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (!raw) return "The analysis request failed. Please try again.";

  // FastAPI's 501 detail is an object; vivaSenseRequest JSON-stringifies
  // anything that is not a plain string detail.
  const parsed = tryParseJson(raw);
  if (parsed && typeof parsed === "object") {
    const message = (parsed as { message?: unknown; detail?: unknown }).message
      ?? (parsed as { detail?: unknown }).detail;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (raw.toLowerCase().includes("aborted") || raw.toLowerCase().includes("timeout")) {
    return "The analysis timed out before the backend responded. Try fewer responses in one run.";
  }
  return raw;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
