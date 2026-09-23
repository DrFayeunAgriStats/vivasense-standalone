import { useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";
import { downloadPersistentRcbdReport } from "@/services/persistenceRcbdApi";
import { GovernedOneFactorPanel } from "./GovernedOneFactorPanel";
import { AcademicResultsPanel } from "./AcademicResultsPanel";
import { isGovernedOneFactor } from "./governedOneFactor";
import { buildDescriptiveStats, describeResultScale } from "./resultCounts";
import { pl } from "@/lib/utils";

interface Props {
  results: UploadAnalysisResponse;
}

/**
 * Read-only renderer for a completed persistent RCBD restored from history.
 *
 * It consumes only the durable AnalysisResult already fetched by
 * readPersistentRcbdAnalysis(). There is intentionally no Run Analysis action
 * here, so reopening a saved analysis cannot invoke R or create a new execution.
 */
export function RestoredRcbdResults({ results }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const persistence = results.persistence;
  const alpha =
    typeof persistence?.alpha === "number"
      ? persistence.alpha
      : Number(results.analysis_settings?.inferential_alpha ?? 0.05);
  const mapping = {
    treatment: persistence?.requested_roles?.treatment,
    rep: persistence?.requested_roles?.rep,
  };

  async function handleDownload() {
    if (!persistence?.analysis_run_id || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadPersistentRcbdReport(
        persistence.analysis_run_id,
        `VivaSense_ANOVA_rcbd_${new Date().toISOString().slice(0, 10)}.docx`,
      );
      sonnerToast.success("Persistent ANOVA report downloaded");
    } catch (error) {
      sonnerToast.error(error instanceof Error ? error.message : "Report download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Saved RCBD Analysis
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Restored from the completed saved result. No analysis was rerun.
            </p>
          </div>
          {persistence?.analysis_run_id && (
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              size="sm"
              className="gap-2"
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Download Persistent ANOVA Report"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{pl(results.dataset_summary.n_genotypes ?? 0, "treatment level")}</Badge>
            <Badge variant="secondary">{pl(results.dataset_summary.n_reps ?? 0, "replication")}</Badge>
            <Badge variant="outline">{results.dataset_summary.mode} mode</Badge>
            <Badge variant="outline">α = {Number.isFinite(alpha) ? alpha.toFixed(2) : "0.05"}</Badge>
          </div>
        </CardContent>
      </Card>

      {Object.entries(results.trait_results).map(([trait, tr]) => {
        if (tr.status !== "success" || !tr.analysis_result?.result) return null;
        const result = tr.analysis_result.result;
        const governed = isGovernedOneFactor(result, "rcbd");

        return (
          <div key={trait} className="space-y-3">
            <h3 className="text-base font-semibold text-foreground px-1">{trait}</h3>
            {governed && (
              <GovernedOneFactorPanel
                design="rcbd"
                result={result}
                mapping={mapping}
                inferentialAlpha={alpha}
              />
            )}
            <AcademicResultsPanel
              moduleLabel="ANOVA"
              domainNeutral
              insightSummary={describeResultScale(result)}
              interpretation={tr.analysis_result.interpretation || ""}
              statisticalNotes={
                tr.data_warnings.length > 0
                  ? tr.data_warnings.map((w) => ({ text: w }))
                  : undefined
              }
              inferentialAlpha={alpha}
              anovaTable={result.anova_table}
              meanSeparation={result.mean_separation}
              descriptiveStats={buildDescriptiveStats(result)}
            />
          </div>
        );
      })}
    </div>
  );
}
