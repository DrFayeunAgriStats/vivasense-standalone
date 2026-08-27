/**
 * Governed Factorial CRD / RCBD v1 result presentation.
 *
 * Ordered by the interaction-first hierarchy: design structure, the three
 * decisions, the hierarchy statement, then whichever comparison actually
 * governs — simple effects under a significant interaction, marginal separation
 * otherwise. Descriptive material (interaction plot, all-cell means) comes last
 * and is labelled as such.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2, MinusCircle, AlertTriangle, XCircle } from "lucide-react";
import type { GeneticsResult } from "@/services/geneticsUploadApi";
import type { GovernedDesignType } from "./anovaDesigns";
import { describeObservationAccounting, describeDiagnosticsPolicy } from "./governedOneFactor";
import {
  readFactorialProfile,
  buildFactorialSummary,
  readDecisions,
  describeHierarchy,
  readSimpleEffects,
  describeMarginalSeparation,
  describeCellSeparation,
  readInteractionPlot,
  type SimpleEffectFamily,
  type MarginalSeparationDisplay,
  type InteractionPlotDisplay,
} from "./governedFactorial";

interface Props {
  design: GovernedDesignType;
  result: GeneticsResult;
  mapping: { rep?: string };
  inferentialAlpha: number;
}

const TONE_ICON = {
  success: CheckCircle2,
  withheld: MinusCircle,
  not_estimable: AlertTriangle,
  failed: XCircle,
  unknown: Info,
} as const;

function LetterTable({ family }: { family: SimpleEffectFamily }) {
  if (!family.showLetters) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1 text-left font-medium">{family.movingFactor}</th>
            <th className="py-1 text-right font-medium">{family.scaleLabel ?? "Mean"}</th>
            <th className="py-1 text-right font-medium">Group</th>
          </tr>
        </thead>
        <tbody>
          {family.levels.map((level, i) => (
            <tr key={level} className="border-b border-dashed last:border-0">
              <td className="py-1">{level}</td>
              <td className="py-1 text-right tabular-nums">{family.means[i]?.toFixed(4) ?? "—"}</td>
              <td className="py-1 text-right font-semibold">{family.groups[i] ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginalBlock({ display }: { display: MarginalSeparationDisplay }) {
  const Icon = TONE_ICON[display.tone];
  return (
    <div className="rounded-md border p-3 space-y-1.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {display.heading}
        {display.authoritative && (
          <Badge variant="outline" className="text-[10px]">authoritative</Badge>
        )}
      </p>
      <p className="text-xs text-muted-foreground">{display.detail}</p>
      {display.meansProvenance && (
        <p className="text-[11px] text-muted-foreground">{display.meansProvenance}</p>
      )}
      {display.showLetters && display.separation && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 text-left font-medium">{display.factor}</th>
                <th className="py-1 text-right font-medium">
                  {display.scaleLabel ?? "Marginal arithmetic mean"}
                </th>
                <th className="py-1 text-right font-medium">Group</th>
              </tr>
            </thead>
            <tbody>
              {display.separation.genotype.map((level, i) => (
                <tr key={level} className="border-b border-dashed last:border-0">
                  <td className="py-1">{level}</td>
                  <td className="py-1 text-right tabular-nums">
                    {display.separation!.mean[i]?.toFixed(4) ?? "—"}
                  </td>
                  <td className="py-1 text-right font-semibold">
                    {display.separation!.group[i] ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Minimal inline line chart — no external plotting dependency, no crop-protection coupling. */
function InteractionChart({ plot }: { plot: InteractionPlotDisplay }) {
  const all = plot.series.flatMap((s) => s.means).filter((m) => Number.isFinite(m));
  if (all.length === 0) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const xs = plot.xLevels.length ? plot.xLevels : plot.series[0].xLevels;
  const W = 420;
  const H = 160;
  const padX = 44;
  const padY = 16;
  const xAt = (i: number) => padX + (xs.length === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (xs.length - 1));
  const yAt = (v: number) => padY + (1 - (v - min) / span) * (H - 2 * padY);
  const palette = ["#0f766e", "#b45309", "#4338ca", "#be123c", "#15803d", "#7c3aed"];

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full min-w-[320px]" role="img"
             aria-label={`Interaction plot: ${plot.yAxisLabel} by ${plot.xAxisFactor} and ${plot.lineFactor}`}>
          <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="currentColor" strokeOpacity="0.25" />
          <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="currentColor" strokeOpacity="0.25" />
          {plot.series.map((s, si) => {
            const colour = palette[si % palette.length];
            const pts = s.means.map((m, i) => `${xAt(i)},${yAt(m)}`).join(" ");
            return (
              <g key={s.label}>
                <polyline points={pts} fill="none" stroke={colour} strokeWidth="2" />
                {s.means.map((m, i) => (
                  <circle key={i} cx={xAt(i)} cy={yAt(m)} r="3" fill={colour} />
                ))}
              </g>
            );
          })}
          {xs.map((level, i) => (
            <text key={level} x={xAt(i)} y={H - padY + 14} textAnchor="middle"
                  fontSize="10" fill="currentColor" fillOpacity="0.7">{level}</text>
          ))}
          <text x={W / 2} y={H + 18} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.6">
            {plot.xAxisFactor}
          </text>
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {plot.series.map((s, si) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm"
                  style={{ backgroundColor: palette[si % palette.length] }} />
            {plot.lineFactor} = {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GovernedFactorialPanel({ design, result, mapping, inferentialAlpha }: Props) {
  const info = readFactorialProfile(result, design, mapping);
  if (!info) return null;

  const decisions = readDecisions(result, info);
  const hierarchy = describeHierarchy(decisions, info);
  const interactionGoverns = hierarchy?.interactionSignificant === true;
  const simple = interactionGoverns ? readSimpleEffects(result) : null;
  const accounting = describeObservationAccounting(result.observation_accounting);
  const analysed = accounting.find(
    (r) => r.label === "Rows analysed" || r.label === "Observations analysed"
  );
  const summary = buildFactorialSummary(info, inferentialAlpha, analysed?.value ?? null);
  const marginalA = describeMarginalSeparation(
    info.factorA, result.factor_a_mean_separation_status, result.mean_separation, interactionGoverns
  );
  const marginalB = describeMarginalSeparation(
    info.factorB, result.factor_b_mean_separation_status, result.mean_separation_b, interactionGoverns
  );
  const cells = describeCellSeparation(result, interactionGoverns);
  const plot = readInteractionPlot(result);
  const policy = describeDiagnosticsPolicy(result, inferentialAlpha);

  return (
    <div className="space-y-4">
      {/* Design / factor information — sourced from factorial_profile only */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Info className="h-4 w-4 text-primary" /> Factor information and design structure
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
          {!info.hasBlockTerm && (
            <p className="text-[11px] text-muted-foreground">
              Sources in the model: {info.factorA}, {info.factorB}, {info.factorA} × {info.factorB},
              and error. No blocking or replication term is fitted.
            </p>
          )}
        </CardContent>
      </Card>

      {/* The three decisions */}
      {decisions.length > 0 && (
        <Card>
          <CardContent className="py-4 px-5 space-y-2">
            <p className="text-sm font-semibold">Inferential decisions</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 text-left font-medium">Term</th>
                    <th className="py-1 text-right font-medium">p-value</th>
                    <th className="py-1 text-right font-medium">α</th>
                    <th className="py-1 text-right font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.key} className="border-b border-dashed last:border-0">
                      <td className="py-1">
                        {d.term}
                        {d.key === "ab" && interactionGoverns && (
                          <Badge variant="default" className="ml-2 text-[10px]">primary</Badge>
                        )}
                        {d.key !== "ab" && interactionGoverns && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">secondary</Badge>
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums">{d.pText.replace("p = ", "").replace("p ", "")}</td>
                      <td className="py-1 text-right tabular-nums">{d.alpha.toFixed(2)}</td>
                      <td className="py-1 text-right font-medium">
                        {!d.estimable ? "Not estimable" : d.significant ? "Significant" : "Not significant"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Decision rule: significant when p ≤ α. Reported by the analysis engine at the α you
              selected — not recalculated here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Interaction-first hierarchy */}
      {hierarchy && (
        <Card className={interactionGoverns ? "border-primary/40" : "border-border"}>
          <CardContent className="py-4 px-5 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              Interpretation hierarchy
              <Badge variant={interactionGoverns ? "default" : "secondary"} className="text-[10px]">
                {interactionGoverns ? "interaction governs" : "marginal effects interpretable"}
              </Badge>
            </p>
            <p className="text-sm">{hierarchy.headline}</p>
            <p className="text-xs text-muted-foreground">{hierarchy.marginalGuidance}</p>
            <p className="text-xs text-muted-foreground">{hierarchy.separationGuidance}</p>
          </CardContent>
        </Card>
      )}

      {/* Governed simple effects — only under a significant interaction */}
      {simple && (simple.aWithinB.length > 0 || simple.bWithinA.length > 0) && (
        <Card className="border-primary/30">
          <CardContent className="py-4 px-5 space-y-3">
            <p className="text-sm font-semibold">Simple effects (governing comparison)</p>
            {simple.message && <p className="text-xs text-muted-foreground">{simple.message}</p>}
            {simple.errorTerm && (
              <p className="text-[11px] text-muted-foreground">Error term: {simple.errorTerm}</p>
            )}
            {simple.multiplicity && (
              <p className="text-[11px] text-muted-foreground">{simple.multiplicity}</p>
            )}
            {[
              { title: `${info.factorA} within each level of ${info.factorB}`, list: simple.aWithinB },
              { title: `${info.factorB} within each level of ${info.factorA}`, list: simple.bWithinA },
            ].map(({ title, list }) =>
              list.length === 0 ? null : (
                <div key={title} className="space-y-2">
                  <p className="text-xs font-medium">{title}</p>
                  {list.map((family) => (
                    <div key={family.family} className="rounded-md border p-3 space-y-1.5">
                      <p className="text-xs font-semibold">{family.family}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Conditioned on {family.fixedFactor} = {family.fixedLevel}; comparing {family.movingFactor}
                        {family.alpha !== null ? ` at α = ${family.alpha.toFixed(2)}` : ""}.
                      </p>
                      {family.showLetters ? (
                        <LetterTable family={family} />
                      ) : (
                        <p className="text-[11px] text-muted-foreground">{family.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Marginal post-hoc gates */}
      {(marginalA || marginalB) && (
        <Card>
          <CardContent className="py-4 px-5 space-y-3">
            <p className="text-sm font-semibold">
              Marginal main-effect mean separation
              {interactionGoverns && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  — secondary while the interaction governs
                </span>
              )}
            </p>
            {marginalA && <MarginalBlock display={marginalA} />}
            {marginalB && <MarginalBlock display={marginalB} />}
          </CardContent>
        </Card>
      )}

      {/* Interaction plot — descriptive */}
      {plot && (
        <Card>
          <CardContent className="py-4 px-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Interaction plot</p>
              <Badge variant="secondary" className="text-[10px]">descriptive</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {plot.yAxisLabel} · {plot.scaleLabel}
            </p>
            <InteractionChart plot={plot} />
            <p className="text-[11px] text-muted-foreground">{plot.note}</p>
          </CardContent>
        </Card>
      )}

      {/* All-cell separation */}
      {cells && (
        <Card className={cells.supplementary ? "border-dashed" : undefined}>
          <CardContent className="py-4 px-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Treatment-combination means</p>
              {cells.supplementary && (
                <Badge variant="secondary" className="text-[10px]">supplementary</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{cells.note}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 text-left font-medium">{cells.factorALabel}</th>
                    <th className="py-1 text-left font-medium">{cells.factorBLabel}</th>
                    <th className="py-1 text-right font-medium">{cells.scaleLabel}</th>
                    <th className="py-1 text-right font-medium">Group</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.rows.map((row, i) => (
                    <tr key={`${row.factorALevel}-${row.factorBLevel}-${i}`} className="border-b border-dashed last:border-0">
                      <td className="py-1">{row.factorALevel}</td>
                      <td className="py-1">{row.factorBLevel}</td>
                      <td className="py-1 text-right tabular-nums">{row.mean?.toFixed(4) ?? "—"}</td>
                      <td className="py-1 text-right font-semibold">{row.group}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnostics policy — identical to Phase C */}
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
