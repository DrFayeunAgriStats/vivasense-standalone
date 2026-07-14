/**
 * API client for VivaSense Descriptive Statistics endpoints.
 *
 * Routes (backend):
 *   POST /analysis/descriptive-stats
 *   POST /export/descriptive-stats-word   (optional)
 */

import { vivaSenseRequest } from "@/services/vivasenseApiClient";
import type {
  DescriptiveStatsRequest,
  DescriptiveStatsResponse,
} from "@/types/descriptiveStats";

export async function computeDescriptiveStats(
  body: DescriptiveStatsRequest
): Promise<DescriptiveStatsResponse> {
  const url = "/analysis/descriptive-stats";
  console.log("[MODULE] descriptive-stats");
  console.log("[REQUEST] descriptive-stats", url, {
    traits: body.trait_columns,
    genotype: body.genotype_column,
    rep: body.rep_column,
    expected_rep: body.expected_replication,
  });
  return vivaSenseRequest<DescriptiveStatsResponse>(url, {
    method: "POST",
    jsonBody: body,
  });
}

export async function exportDescriptiveStatsWord(
  payload: DescriptiveStatsRequest | { response: DescriptiveStatsResponse } | Record<string, unknown>
): Promise<Blob> {
  const url = "/export/descriptive-stats-word";
  console.log("[MODULE] descriptive-stats");
  console.log("[REQUEST] export-descriptive-stats-word", url, payload);
  return vivaSenseRequest<Blob>(url, {
    method: "POST",
    jsonBody: payload,
    responseType: "blob",
  });
}
