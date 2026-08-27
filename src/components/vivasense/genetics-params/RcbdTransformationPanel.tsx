/**
 * Governed RCBD transformation workflow — one panel per response variable.
 *
 * State is deliberately per-trait: exploring or selecting a transformation for
 * one response must not touch another. A single global toggle would make that
 * impossible to express.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FlaskConical, AlertTriangle, Info, Download, CheckCircle2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import type { AnovaAlpha, GeneticsResult } from "@/services/geneticsUploadApi";
import {
  exploreRcbdTransformation,
  selectRcbdTransformedAnalysis,
  exportSelectedTransformedWord,
  type ExplorationResponse,
  type SelectedTransformedAnalysis,
} from "@/services/rcbdTransformationApi";
import {
  buildExplorationRequest,
  buildSelectionRequest,
  readLambda,
  readSelectionGate,
  readSelectedBranch,
  describeTransformationFailure,
  authorityLabel,
  authorityDetail,
  semanticsCaution,
  TRANSFORMED_DIAGNOSTICS_NOTE,
  SELECTION_MEANING_NOTE,
  type AuthorityState,
  type ResponseType,
} from "./governedTransformation";

interface Props {
  trait: string;
  rawAnalysisToken: string;
  alpha: AnovaAlpha;
  rawResult: GeneticsResult;
  responseType?: ResponseType;
}

const ACK_TEXT =
  "I acknowledge that diagnostic concerns remain and that selecting this transformed analysis does not " +
  "assert that the model assumptions have been resolved.";

export function RcbdTransformationPanel({
  trait,
  rawAnalysisToken,
  alpha,
  rawResult,
  responseType = "continuous",
}: Props) {
  const [exploration, setExploration] = useState<ExplorationResponse | null>(null);
  const [selected, setSelected] = useState<SelectedTransformedAnalysis | null>(null);
  const [isExploring, setIsExploring] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const state: AuthorityState = selected
    ? "transformed_selected"
    : exploration
      ? "explored_not_selected"
      : "raw_primary";

  const gate = readSelectionGate(exploration);
  const lambda = readLambda(exploration?.candidate as Record<string, unknown>);
  const branch = readSelectedBranch(selected);
  const caution = semanticsCaution(responseType);
  // The backend reports remaining concerns as warnings on the exploration.
  const concernWarnings = lambda?.warnings ?? [];
  const needsAcknowledgement = gate.selectable && concernWarnings.length > 0;

  const handleExplore = async () => {
    if (isExploring) return; // no double submission
    setIsExploring(true);
    setError(null);
    try {
      const response = await exploreRcbdTransformation(
        buildExplorationRequest({ rawAnalysisToken, trait, alpha, responseType })
      );
      setExploration(response);
      // A fresh exploration invalidates any previous selection for this trait.
      setSelected(null);
      setAcknowledged(false);
    } catch (err) {
      setError(describeTransformationFailure(err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExploring(false);
    }
  };

  const handleSelect = async () => {
    if (!exploration || isSelecting || !gate.selectable) return;
    if (needsAcknowledgement && !acknowledged) return;
    setIsSelecting(true);
    setError(null);
    try {
      const response = await selectRcbdTransformedAnalysis(
        buildSelectionRequest(exploration, needsAcknowledgement ? ACK_TEXT : null)
      );
      setSelected(response);
      sonnerToast.success(`Transformed analysis selected for ${trait}`);
    } catch (err) {
      setError(describeTransformationFailure(err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSelecting(false);
    }
  };

  const handleDownload = async () => {
    if (!selected || isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      const blob = await exportSelectedTransformedWord({
        selected_analysis_token: selected.selected_analysis_token,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VivaSense_RCBD_transformed_${trait}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      sonnerToast.success("Selected transformed-analysis report downloaded");
    } catch (err) {
      setError(describeTransformationFailure(err instanceof Error ? err.message : String(err)));
      sonnerToast.error("Report not generated");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="py-4 px-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 text-primary" /> Alternative transformation
          </p>
          <Badge variant={state === "transformed_selected" ? "default" : "secondary"} className="text-[10px]">
            {authorityLabel(state)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{authorityDetail(state)}</p>

        {caution && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200">
            {caution}
          </p>
        )}

        {!exploration && (
          <Button size="sm" variant="outline" onClick={handleExplore} disabled={isExploring} className="gap-2">
            {isExploring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            {isExploring ? "Exploring…" : "Explore an alternative transformation"}
          </Button>
        )}

        {error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs space-y-1">
            <p className="font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Transformation step not completed
            </p>
            <p>{error}</p>
          </div>
        )}

        {/* ── Exploration result ── */}
        {exploration && lambda && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold">Box-Cox exploration</p>
              <Badge variant="outline" className="text-[10px]">
                {exploration.authority === "exploratory_not_selected_for_inference"
                  ? "exploratory — not selected"
                  : exploration.authority}
              </Badge>
            </div>

            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Row label="λ (lambda)" value={lambda.lambdaText} />
              {lambda.transform && <Row label="Transform" value={lambda.transform} />}
              {lambda.formula && <Row label="Formula" value={lambda.formula} />}
              {lambda.shift !== null && <Row label="Shift applied" value={lambda.shift.toFixed(4)} />}
              {lambda.searchRange && <Row label="Search range" value={lambda.searchRange} />}
              {lambda.profileInterval && (
                <Row
                  label={`Profile interval${lambda.confidenceLevel ? ` (${(lambda.confidenceLevel * 100).toFixed(0)}%)` : ""}`}
                  value={lambda.profileInterval}
                />
              )}
              {lambda.exactness && <Row label="Profile method" value={lambda.exactness} />}
            </dl>

            {(lambda.boundaryHit || lambda.intervalTruncated || lambda.warnings.length > 0) && (
              <div className="rounded-md border border-amber-400 bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/20 dark:border-amber-700 dark:text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Boundary / truncation warning
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {lambda.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">{TRANSFORMED_DIAGNOSTICS_NOTE}</p>

            {!gate.selectable && gate.blockedExplanation && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
                <span className="font-semibold">Not eligible for selection. </span>
                {gate.blockedExplanation}
              </p>
            )}

            {gate.selectable && !selected && (
              <div className="space-y-2">
                {needsAcknowledgement && (
                  <label className="flex items-start gap-2 text-xs">
                    <Checkbox
                      checked={acknowledged}
                      onCheckedChange={(v) => setAcknowledged(v === true)}
                      aria-label="Acknowledge remaining diagnostic concerns"
                    />
                    <span>{ACK_TEXT}</span>
                  </label>
                )}
                <p className="text-[11px] text-muted-foreground">{SELECTION_MEANING_NOTE}</p>
                <Button
                  size="sm"
                  onClick={handleSelect}
                  disabled={isSelecting || (needsAcknowledgement && !acknowledged)}
                  className="gap-2"
                >
                  {isSelecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Use this transformed analysis for inferential reporting
                </Button>
              </div>
            )}

            <Button size="sm" variant="ghost" onClick={handleExplore} disabled={isExploring}>
              Re-run exploration
            </Button>
          </div>
        )}

        {/* ── Selected branch ── */}
        {branch && (
          <div className="space-y-3 rounded-md border border-primary/40 p-3">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Selected transformed analysis
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground">Raw (original scale) — reference</p>
                <dl className="text-xs space-y-0.5">
                  <Row label="Treatment decision"
                       value={rawResult.treatment_decision?.significant ? "Significant" : "Not significant"} />
                  <Row label="p-value"
                       value={rawResult.treatment_decision?.p_value?.toExponential(3) ?? "—"} />
                  <Row label="Mean separation"
                       value={rawResult.mean_separation_status?.status ?? (rawResult.mean_separation ? "success" : "—")} />
                </dl>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground">Selected transformed — inferential</p>
                <dl className="text-xs space-y-0.5">
                  <Row label="λ" value={branch.lambda?.lambdaText ?? "—"} />
                  <Row label="Transformed decision"
                       value={branch.decisionSignificant === null ? "—" : branch.decisionSignificant ? "Significant" : "Not significant"} />
                  <Row label="p-value" value={branch.decisionPValue?.toExponential(3) ?? "—"} />
                  <Row label="Residual MS / df"
                       value={`${branch.residualMs?.toFixed(6) ?? "—"} / ${branch.residualDf ?? "—"}`} />
                </dl>
              </div>
            </div>

            {branch.tukeyRows.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold">
                  {branch.tukeyMethod ?? "Tukey HSD"} — transformed branch
                </p>
                {branch.tukeyMeansProvenance && (
                  <p className="text-[11px] text-muted-foreground">{branch.tukeyMeansProvenance}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-1 text-left font-medium">Treatment</th>
                        <th className="py-1 text-right font-medium">Transformed-scale mean</th>
                        <th className="py-1 text-right font-medium">Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branch.tukeyRows.map((row) => (
                        <tr key={row.level} className="border-b border-dashed last:border-0">
                          <td className="py-1">{row.level}</td>
                          <td className="py-1 text-right tabular-nums">{row.mean?.toFixed(6) ?? "—"}</td>
                          <td className="py-1 text-right font-semibold">{row.group}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {branch.backTransformed.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold">
                  {branch.backTransformed[0].scaleLabel}s
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-1 text-left font-medium">Treatment</th>
                        <th className="py-1 text-right font-medium">{branch.backTransformed[0].scaleLabel}</th>
                        <th className="py-1 text-right font-medium">Interval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branch.backTransformed.map((row) => (
                        <tr key={row.treatment} className="border-b border-dashed last:border-0">
                          <td className="py-1">{row.treatment}</td>
                          <td className="py-1 text-right tabular-nums">{row.estimate?.toFixed(4) ?? "—"}</td>
                          <td className="py-1 text-right tabular-nums">
                            {row.interval ? `${row.interval[0].toFixed(4)} – ${row.interval[1].toFixed(4)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {branch.backTransformed[0].intervalMethod && (
                  <p className="text-[11px] text-muted-foreground">
                    {branch.backTransformed[0].intervalMethod}
                  </p>
                )}
              </div>
            )}

            <p className="rounded-md border border-dashed p-2.5 text-[11px]">
              <span className="font-semibold">Interpretation authority. </span>
              The transformed branch is selected for inferential reporting for {trait}. The raw analysis
              above remains available as the original-scale reference; conclusions reported as inferential
              should come from the selected branch. {SELECTION_MEANING_NOTE}
            </p>

            {branch.acknowledgements.length > 0 && (
              <ul className="list-disc pl-5 text-[11px] text-muted-foreground">
                {branch.acknowledgements.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}

            <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-2">
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download selected transformed-analysis report
            </Button>
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              This is separate from the raw/original-scale report, which remains available above.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
