/**
 * Study review — the Validation → Analysis step of the workflow.
 * Summarizes collection completeness, flags out-of-range values, and exports the
 * collected data as an analysis-ready Excel file that feeds the existing
 * VivaSense analysis engine (upload → analyze). No new backend.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { buildCollectedDataset, type CollectedDataset } from "@/services/dataCapture/dataCaptureService";
import { downloadCollectedData } from "@/lib/dataCapture/collectedDataExport";

interface Props {
  studyId: string;
  studyTitle: string;
}

export function StudyReview({ studyId, studyTitle }: Props) {
  const { toast } = useToast();
  const [dataset, setDataset] = useState<CollectedDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    buildCollectedDataset(studyId)
      .then((d) => { if (active) setDataset(d); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studyId]);

  const exportData = () => {
    if (!dataset) return;
    const safe = studyTitle.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
    downloadCollectedData(dataset, `VivaSense_${safe}_data_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Dataset exported", description: "Upload it in the Workspace to analyze." });
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error) return <div className="py-12 text-center text-sm text-destructive">{error}</div>;
  if (!dataset) return null;

  const pct = dataset.totalPlots > 0 ? Math.round((dataset.completedPlots / dataset.totalPlots) * 100) : 0;
  const ready = dataset.incompletePlots.length === 0 && dataset.outOfRange.length === 0;

  return (
    <div className="space-y-4">
      {/* Completion */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-foreground">Collection completeness</span>
          <span className="tabular-nums text-muted-foreground">{dataset.completedPlots}/{dataset.totalPlots} · {pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Validation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Validation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ready ? (
            <p className="inline-flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> All plots complete and within range — ready for analysis.</p>
          ) : (
            <>
              {dataset.incompletePlots.length > 0 && (
                <div className="text-sm">
                  <p className="inline-flex items-center gap-1.5 text-amber-600 font-medium"><AlertTriangle className="h-4 w-4" /> {dataset.incompletePlots.length} incomplete plot(s)</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dataset.incompletePlots.slice(0, 40).map((n) => <Badge key={n} variant="outline" className="text-[11px]">#{n}</Badge>)}
                    {dataset.incompletePlots.length > 40 && <span className="text-xs text-muted-foreground">+{dataset.incompletePlots.length - 40} more</span>}
                  </div>
                </div>
              )}
              {dataset.outOfRange.length > 0 && (
                <div className="text-sm">
                  <p className="inline-flex items-center gap-1.5 text-destructive font-medium"><AlertTriangle className="h-4 w-4" /> {dataset.outOfRange.length} out-of-range value(s)</p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {dataset.outOfRange.slice(0, 12).map((f, i) => <li key={i}>Plot #{f.plot} · {f.trait} = {f.value}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Analysis handoff */}
      <Card>
        <CardHeader><CardTitle className="text-base">Analyze</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export the collected data as an analysis-ready spreadsheet ({dataset.rows.length} plots × {Math.max(0, dataset.headers.length - 3)} traits),
            then upload it in the Workspace to run ANOVA, correlation, and more.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData}><Download className="mr-1.5 h-4 w-4" /> Export dataset (Excel)</Button>
            <Button variant="outline" asChild>
              <Link to="/workspace">Go to Analysis <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
