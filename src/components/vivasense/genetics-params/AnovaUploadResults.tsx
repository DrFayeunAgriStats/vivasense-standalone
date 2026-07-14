import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { AcademicResultsPanel } from "./AcademicResultsPanel";
import type { UploadAnalysisResponse } from "@/services/geneticsUploadApi";

interface Props {
  results: UploadAnalysisResponse;
}

/**
 * Design-agnostic renderer for a /genetics/analyze-upload?module=anova response.
 * Renders one AcademicResultsPanel per successful trait (ANOVA table, ranked means
 * with Tukey groups, diagnostics, interpretation). Used by callers that produce an
 * ANOVA result outside the AnovaModulePanel form (e.g. the Genetics workspace form).
 */
export function AnovaUploadResults({ results }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ANOVA Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{results.dataset_summary.n_genotypes} treatment level(s)</Badge>
            <Badge variant="secondary">{results.dataset_summary.n_reps} replication(s)</Badge>
            <Badge variant="outline">{results.dataset_summary.mode} mode</Badge>
          </div>
        </CardContent>
      </Card>

      {results.failed_traits.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-destructive font-medium mb-1">
              <AlertTriangle className="h-4 w-4" /> Failed Response Variables
            </div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {results.failed_traits.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {Object.entries(results.trait_results).map(([trait, tr]) => {
        if (tr.status !== "success" || !tr.analysis_result) return null;
        const r = tr.analysis_result.result;
        if (!r) return null;

        return (
          <div key={trait} className="space-y-1">
            <h3 className="text-base font-semibold text-foreground px-1">{trait}</h3>
            <AcademicResultsPanel
              moduleLabel="ANOVA"
              domainNeutral
              insightSummary={`Grand mean: ${r.grand_mean?.toFixed(2) ?? "—"} | ${r.n_genotypes} treatment level(s) × ${r.n_reps} replication(s)`}
              interpretation={tr.analysis_result.interpretation || ""}
              statisticalNotes={
                tr.data_warnings.length > 0
                  ? tr.data_warnings.map((w) => ({ text: w }))
                  : undefined
              }
              anovaTable={r.anova_table}
              meanSeparation={r.mean_separation}
              descriptiveStats={[
                { label: "Grand Mean", value: r.grand_mean?.toFixed(4) ?? "—" },
                { label: "Treatment Levels", value: String(r.n_genotypes) },
                { label: "Replications", value: String(r.n_reps) },
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}
