/**
 * Governed CRD / RCBD v1 result presentation.
 *
 * Extends the existing standalone results flow — it sits alongside
 * AcademicResultsPanel rather than replacing it, and renders nothing at all
 * unless the backend actually sent the governed decision objects.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Info, MinusCircle, AlertTriangle, XCircle } from "lucide-react";
import type { GeneticsResult } from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "./anovaDesigns";
import {
  buildDesignSummary,
  describeOmnibus,
  describeSeparationGate,
  describeObservationAccounting,
  describeDiagnosticsPolicy,
  type SeparationTone,
} from "./governedOneFactor";

interface Props {
  design: GovernedDesignType;
  result: GeneticsResult;
  mapping: { treatment?: string; rep?: string };
  inferentialAlpha: number;
}

const TONE_STYLES: Record<SeparationTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800" },
  withheld: { icon: MinusCircle, className: "border-slate-300 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-700" },
  not_estimable: { icon: AlertTriangle, className: "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" },
  failed: { icon: XCircle, className: "border-destructive/40 bg-destructive/5" },
  unknown: { icon: Info, className: "border-border bg-muted/30" },
};

export function GovernedOneFactorPanel({ design, result, mapping, inferentialAlpha }: Props) {
  const factorLabel = mapping.treatment ? `"${mapping.treatment}"` : "treatment";
  const omnibus = describeOmnibus(result.treatment_decision, factorLabel);
  const hasLetters = !!result.mean_separation?.group?.length;
  const separation = describeSeparationGate(result.mean_separation_status, hasLetters);
  const summary = buildDesignSummary(design, result, mapping, inferentialAlpha);
  const accounting = describeObservationAccounting(result.observation_accounting);
  const policy = describeDiagnosticsPolicy(result, inferentialAlpha);

  return (
    <div className="space-y-4">
      {/* Design summary */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Info className="h-4 w-4 text-primary" /> Design and analysis summary
          </p>
          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {summary.map((row) => (
              <div key={row.label} className="border-b border-dashed py-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium text-right">{row.value}</dd>
                </div>
                {row.note && <p className="mt-0.5 text-[11px] text-muted-foreground">{row.note}</p>}
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Inferential decision — taken from the backend decision object */}
      {omnibus && (
        <Card className={omnibus.significant ? "border-emerald-300 dark:border-emerald-800" : "border-border"}>
          <CardContent className="py-4 px-5 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Inferential decision</p>
              <Badge variant={omnibus.significant ? "default" : "secondary"} className="text-xs">
                {omnibus.estimable
                  ? omnibus.significant
                    ? "Significant"
                    : "Not significant"
                  : "Not estimable"}
              </Badge>
              <Badge variant="outline" className="text-xs">α = {omnibus.alpha.toFixed(2)}</Badge>
            </div>
            <p className="text-sm">{omnibus.sentence}</p>
            <p className="text-xs text-muted-foreground">
              {omnibus.rule} Reported by the analysis engine at the α you selected — not recalculated here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mean-separation gate */}
      {separation && (() => {
        const { icon: Icon, className } = TONE_STYLES[separation.tone];
        return (
          <Card className={className}>
            <CardContent className="py-4 px-5 space-y-1.5">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Icon className="h-4 w-4" /> {separation.heading}
              </p>
              <p className="text-xs">{separation.detail}</p>
              {(separation.method || separation.alpha !== null) && (
                <p className="text-[11px] text-muted-foreground">
                  {separation.method ? `Method: ${separation.method}.` : ""}
                  {separation.alpha !== null ? ` Evaluated at α = ${separation.alpha.toFixed(2)}.` : ""}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Observation accounting */}
      {accounting.length > 0 && (
        <Card>
          <CardContent className="py-4 px-5 space-y-2">
            <p className="text-sm font-semibold">Observation accounting</p>
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {accounting.map((row) => (
                <div key={row.label} className="flex justify-between gap-3 border-b border-dashed py-0.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Diagnostics governance */}
      <Card>
        <CardContent className="py-4 px-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Assumption diagnostics policy</p>
            <Badge variant="outline" className="text-xs">
              diagnostic α = {policy.diagnosticAlpha.toFixed(2)} (fixed)
            </Badge>
            <Badge variant="outline" className="text-xs">
              inferential α = {policy.inferentialAlpha.toFixed(2)}
            </Badge>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
            {policy.statements.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
