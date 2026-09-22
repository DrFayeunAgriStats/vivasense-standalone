import type { AnalysisHistoryRecord } from "./historyTypes";
import { downloadPersistentRcbdReport } from "@/services/persistenceRcbdApi";

const PERSISTENCE_RUN_ID_KEY = "persistence_analysis_run_id";

/**
 * Return the durable AnalysisRun id only when the history row represents a
 * successful governed RCBD ANOVA run. The id is stored in analysis_parameters
 * by AnovaModulePanel at the moment the governed run completes.
 */
export function persistentRcbdAnalysisRunId(
  record: AnalysisHistoryRecord,
): string | null {
  if (record.analysis_status !== "success") return null;
  if (record.analysis_type !== "anova") return null;
  if ((record.design_type ?? "").toLowerCase() !== "rcbd") return null;

  const value = record.analysis_parameters?.[PERSISTENCE_RUN_ID_KEY];
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasPersistentRcbdReport(record: AnalysisHistoryRecord): boolean {
  return persistentRcbdAnalysisRunId(record) !== null;
}

function safeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/**
 * Download the permanent Word report for the exact durable AnalysisRun stored
 * on this history row. No export token or trait-only fallback is used.
 */
export async function downloadPersistentReportFromHistory(
  record: AnalysisHistoryRecord,
): Promise<void> {
  const analysisRunId = persistentRcbdAnalysisRunId(record);
  if (!analysisRunId) {
    throw new Error(
      "This history entry is not linked to a completed persistent RCBD AnalysisRun.",
    );
  }

  await downloadPersistentRcbdReport(
    analysisRunId,
    `VivaSense_ANOVA_rcbd_${safeDate(record.created_at)}.docx`,
  );
}
