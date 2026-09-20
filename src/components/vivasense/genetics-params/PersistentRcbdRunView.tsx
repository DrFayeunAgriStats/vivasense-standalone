import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GovernedOneFactorPanel } from "./GovernedOneFactorPanel";
import { AcademicResultsPanel } from "./AcademicResultsPanel";
import { describeResultScale, buildDescriptiveStats } from "./resultCounts";
import {
  downloadPersistentRcbdReport,
  readPersistentRcbdAnalysis,
} from "@/services/persistenceRcbdApi";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";
import { pl } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  analysisRunId: string;
  onStartNew?: () => void;
}

export function PersistentRcbdRunView({ analysisRunId, onStartNew }: Props) {
  const [results, setResults] = useState<UploadAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    readPersistentRcbdAnalysis(analysisRunId)
      .then((value) => {
        if (active) setResults(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analysisRunId]);

  const alpha = useMemo(() => {
    if (!results) return 0.05;
    for (const tr of Object.values(results.trait_results)) {
      const value = tr.analysis_result?.result?.treatment_decision?.alpha;
      if (typeof value === "number") return value;
    }
    return 0.05;
  }, [results]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadPersistentRcbdReport(analysisRunId, "plant_breeding");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VivaSense_ANOVA_rcbd_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Durable ANOVA report downloaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error("Report download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Recovering the governed AnalysisRun…
        </CardContent>
      </Card>
    );
  }

  if (error || !results) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="space-y-3 py-8">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Could not recover this AnalysisRun
          </div>
          <p className="text-sm text-muted-foreground">{error ?? "No durable result was returned."}</p>
          {onStartNew && (
            <Button variant="outline" onClick={onStartNew}>
              Start a new analysis
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-300/60 dark:border-emerald-800">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Recovered ANOVA Results — Randomized Complete Block Design (RCBD)
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Loaded from the immutable governed AnalysisResult, not recomputed from the browser.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {onStartNew && (
              <Button variant="outline" size="sm" onClick={onStartNew} className="gap-2">
                <RotateCcw className="h-4 w-4" /> New analysis
              </Button>
            )}
            <Button size="sm" onClick={handleDownload} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Downloading…" : "Download ANOVA Report"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{pl(results.dataset_summary.n_genotypes ?? 0, "treatment level")}</Badge>
            <Badge variant="secondary">{pl(results.dataset_summary.n_reps ?? 0, "replication")}</Badge>
            <Badge variant="outline">α = {alpha.toFixed(2)}</Badge>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
              durable run · RECOVERED_COMPLETE
            </Badge>
          </div>
          <p className="mt-2 break-all text-xs text-muted-foreground">
            AnalysisRun {results.persistence?.analysis_run_id} · DatasetVersion {results.persistence?.dataset_version_id}
          </p>
        </CardContent>
      </Card>

      {Object.entries(results.trait_results).map(([trait, tr]) => {
        const result = tr.analysis_result?.result;
        if (tr.status !== "success" || !result) return null;
        return (
          <div key={trait} className="space-y-3">
            <h3 className="px-1 text-base font-semibold text-foreground">{trait}</h3>
            <GovernedOneFactorPanel
              design="rcbd"
              result={result}
              mapping={{ treatment: "genotype", rep: "rep" }}
              inferentialAlpha={alpha}
            />
            <AcademicResultsPanel
              moduleLabel="ANOVA"
              domainNeutral
              insightSummary={describeResultScale(result)}
              interpretation={tr.analysis_result?.interpretation || ""}
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
