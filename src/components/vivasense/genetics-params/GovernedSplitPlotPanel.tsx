/**
 * Governed Split-Plot RCBD v1 result presentation.
 *
 * Ordered so the design is understood before any verdict: structure,
 * experimental units, the two error strata, then the decisions and what governs
 * interpretation. Descriptive material comes last and is labelled as such.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2, MinusCircle, AlertTriangle, XCircle, Layers } from "lucide-react";
import type { GeneticsResult } from "@/services/geneticsUploadApi";
import { describeObservationAccounting, describeDiagnosticsPolicy } from "./governedOneFactor";
import {
  readSplitPlotProfile,
  buildSplitPlotSummary,
  describeExperimentalUnits,
  readErrorStrata,
  readSplitPlotDecisions,
  describeSplitPlotHierarchy,
  describeProtectedLsd,
  readInteractionMeans,
  readSplitPlotInteractionPlot,
  splitPlotDiagnosticStatements,
  type ProtectedLsdDisplay,
  type SplitPlotPlotDisplay,
} from "./governedSplitPlot";

interface Props {
  result: GeneticsResult;
  mapping: { rep?: string; mainPlot?: string; subPlot?: string };
  inferentialAlpha: number;
}

const TONE_ICON = {
  success: CheckCircle2,
  withheld: MinusCircle,
  not_estimable: AlertTriangle,
  failed: XCircle,
  unknown: Info,
} as const;

function num(value: number | null, digits = 4): string {
  return value === null ? "—" : value.toFixed(digits);
}

function LsdBlock({ display }: { display: ProtectedLsdDisplay }) {
  const Icon = TONE_ICON[display.tone];
  return (
    <div className="rounded-md border p-3 space-y-1.5">
      <p className="text-xs font-semibold flex flex-wrap items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {display.heading}
        {display.authoritative && <Badge variant="outline" className="text-[10px]">authoritative</Badge>}
      </p>
      <p className="text-xs text-muted-foreground">{display.detail}</p>
      {(display.errorStratum || display.errorDf !== null) && (
        <p className="text-[11px] text-muted-foreground">
          Error stratum: {display.errorStratum ?? "—"}
          {display.errorMs !== null ? ` · MS = ${num(display.errorMs)}` : ""}
          {display.errorDf !== null ? ` · df = ${display.errorDf}` : ""}
        </p>
      )}
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
                  {display.separation.scale_label ?? "Marginal arithmetic mean"}
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
                  <td className="py-1 text-right font-semibold">{display.separation!.group[i] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Inline SVG — no crop-protection coupling. */
function SplitPlotChart({ plot }: { plot: SplitPlotPlotDisplay }) {
  const all = plot.series.flatMap((s) => s.means).filter((m) => Number.isFinite(m));
  if (all.length === 0) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const xs = plot.xLevels;
  const W = 420, H = 160, padX = 44, padY = 16;
  const xAt = (i: number) =>
    padX + (xs.length === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (xs.length - 1));
  const yAt = (v: number) => padY + (1 - (v - min) / span) * (H - 2 * padY);
  const palette = ["#0f766e", "#b45309", "#4338ca", "#be123c", "#15803d", "#7c3aed"];

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full min-w-[320px]" role="img"
             aria-label={`Descriptive interaction plot: ${plot.scaleLabel} by ${plot.xAxisFactor} and ${plot.lineFactor}`}>
          <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="currentColor" strokeOpacity="0.25" />
          <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="currentColor" strokeOpacity="0.25" />
          {plot.series.map((s, si) => {
            const colour = palette[si % palette.length];
            const pts = s.means
              .map((m, i) => (Number.isFinite(m) ? `${xAt(i)},${yAt(m)}` : null))
              .filter(Boolean)
              .join(" ");
            return (
              <g key={s.label}>
                <polyline points={pts} fill="none" stroke={colour} strokeWidth="2" />
                {s.means.map((m, i) =>
                  Number.isFinite(m) ? <circle key={i} cx={xAt(i)} cy={yAt(m)} r="3" fill={colour} /> : null
                )}
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

export function GovernedSplitPlotPanel({ result, mapping, inferentialAlpha }: Props) {
  const info = readSplitPlotProfile(result, mapping);
  if (!info) return null;

  const summary = buildSplitPlotSummary(info, inferentialAlpha);
  const units = describeExperimentalUnits(info);
  const strata = readErrorStrata(result, info);
  const decisions = readSplitPlotDecisions(result, info);
  const hierarchy = describeSplitPlotHierarchy(decisions, info);
  const interactionGoverns = hierarchy?.interactionSignificant === true;
  const lsdA = describeProtectedLsd(
    info.wholePlotFactor, result.main_plot_separation_status, result.main_plot_mean_separation, interactionGoverns
  );
  const lsdB = describeProtectedLsd(
    info.subPlotFactor, result.sub_plot_separation_status, result.mean_separation, interactionGoverns
  );
  const cells = readInteractionMeans(result);
  const plot = readSplitPlotInteractionPlot(result, info);
  const accounting = describeObservationAccounting(result.observation_accounting);
  const policy = describeDiagnosticsPolicy(result, inferentialAlpha);
  const splitPlotDiagnostics = splitPlotDiagnosticStatements(info);

  return (
    <div className="space-y-4">
      {/* Design structure */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Info className="h-4 w-4 text-primary" /> Split-plot design structure
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

      {/* Experimental units */}
      <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="py-4 px-5 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Layers className="h-4 w-4" /> Experimental units
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            {units.statements.map((s) => <li key={s}>{s}</li>)}
          </ul>
          {units.engineNote && (
            <p className="text-[11px] text-muted-foreground border-t border-dashed pt-2">
              {units.engineNote}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error strata */}
      {strata.length > 0 && (
        <Card>
          <CardContent className="py-4 px-5 space-y-2">
            <p className="text-sm font-semibold">Error strata</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 text-left font-medium">Stratum</th>
                    <th className="py-1 text-left font-medium">Role</th>
                    <th className="py-1 text-left font-medium">Denominator for</th>
                    <th className="py-1 text-right font-medium">df</th>
                    <th className="py-1 text-right font-medium">MS</th>
                  </tr>
                </thead>
                <tbody>
                  {strata.map((s) => (
                    <tr key={s.name} className="border-b border-dashed last:border-0">
                      <td className="py-1 font-medium">{s.name}</td>
                      <td className="py-1 text-muted-foreground">{s.role}</td>
                      <td className="py-1">{s.testedTerms.join(", ")}</td>
                      <td className="py-1 text-right tabular-nums">{s.df ?? "—"}</td>
                      <td className="py-1 text-right tabular-nums">{num(s.ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Denominator degrees of freedom and mean squares are reported by the analysis engine with
              each decision — they are not recalculated here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Decisions */}
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
                    <th className="py-1 text-left font-medium">Error stratum</th>
                    <th className="py-1 text-right font-medium">df</th>
                    <th className="py-1 text-right font-medium">MS</th>
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
                      <td className="py-1 text-right tabular-nums">
                        {d.pText.replace("p = ", "").replace("p ", "")}
                      </td>
                      <td className="py-1 text-right tabular-nums">{d.alpha.toFixed(2)}</td>
                      <td className="py-1">{d.errorStratum}</td>
                      <td className="py-1 text-right tabular-nums">{d.denominatorDf ?? "—"}</td>
                      <td className="py-1 text-right tabular-nums">{num(d.denominatorMs)}</td>
                      <td className="py-1 text-right font-medium">
                        {!d.estimable ? "Not estimable" : d.significant ? "Significant" : "Not significant"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Reported by the analysis engine at the selected α — not recalculated here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hierarchy + v1 limitation */}
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
            {hierarchy.limitation && (
              <p className="rounded-md border border-dashed p-2.5 text-xs">
                <span className="font-semibold">Split-Plot v1 limitation. </span>
                {hierarchy.limitation}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Protected Fisher's LSD */}
      {(lsdA || lsdB) && (
        <Card>
          <CardContent className="py-4 px-5 space-y-3">
            <p className="text-sm font-semibold">
              Protected Fisher&apos;s LSD
              {interactionGoverns && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  — secondary summaries while the interaction governs
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Each factor is gated by its own omnibus test on its own error stratum — a significant
              result for one factor does not open mean separation for the other.
            </p>
            {lsdA && <LsdBlock display={lsdA} />}
            {lsdB && <LsdBlock display={lsdB} />}
          </CardContent>
        </Card>
      )}

      {/* Descriptive interaction plot */}
      {plot && (
        <Card>
          <CardContent className="py-4 px-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Descriptive interaction plot</p>
              <Badge variant="secondary" className="text-[10px]">descriptive</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{plot.scaleLabel}</p>
            <SplitPlotChart plot={plot} />
            <p className="text-[11px] text-muted-foreground">{plot.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Cell means */}
      {cells && (
        <Card>
          <CardContent className="py-4 px-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Treatment-combination means</p>
              <Badge variant="secondary" className="text-[10px]">descriptive</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{cells.note}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 text-left font-medium">{info.wholePlotFactor}</th>
                    <th className="py-1 text-left font-medium">{info.subPlotFactor}</th>
                    <th className="py-1 text-right font-medium">{cells.scaleLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.rows.map((row, i) => (
                    <tr key={`${row.wholePlotLevel}-${row.subPlotLevel}-${i}`}
                        className="border-b border-dashed last:border-0">
                      <td className="py-1">{row.wholePlotLevel}</td>
                      <td className="py-1">{row.subPlotLevel}</td>
                      <td className="py-1 text-right tabular-nums">
                        {Number.isFinite(row.mean) ? row.mean.toFixed(4) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cells.cellSe !== null && (
              <p className="text-[11px] text-muted-foreground">
                Standard error of a cell mean: {num(cells.cellSe)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Observation accounting — only when the backend sent real fields */}
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

      {/* Diagnostics */}
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
            {splitPlotDiagnostics.map((s) => <li key={s}>{s}</li>)}
            {policy.statements.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
