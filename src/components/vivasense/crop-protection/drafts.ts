/**
 * Response-draft factory.
 *
 * Kept out of the component file so that module exports only components —
 * mixing the two breaks fast refresh.
 */
import type { ResponseDraft } from "@/types/cropProtection";

export function emptyDraft(index: number): ResponseDraft {
  return {
    key: `response-${Date.now()}-${index}`,
    id: "",
    type: "mortality",
    rawColumn: "",
    inferenceColumn: "",
    observationTime: "",
    timeUnit: "h",
    abbottCorrection: true,
    cumulative: true,
  };
}
