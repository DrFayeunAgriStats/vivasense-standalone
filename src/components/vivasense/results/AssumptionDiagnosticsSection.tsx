import { Component, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VsResultSection } from "./VsResultSection";

/* ---------- Backend payload shapes (all fields optional) ---------- */

interface TestResult {
  statistic?: number;
  p_value?: number;
  passed?: boolean;
}

interface ReviewerMode {
  status?: "PASS" | "WARN" | string;
  summary?: string;
}

interface AssumptionTests {
  normality?: TestResult;
  homogeneity?: TestResult;
  overall?: { passed?: boolean };
  reviewer_mode?: ReviewerMode;
  outlier_detection?: unknown;
}

interface DiagnosticObservation {
  observation?: number | string;
  treatment?: string | number;
  block?: string | number | null;
  observed?: number;
  fitted?: number;
  residual?: number;
  standardized_residual?: number;
  cooks_distance?: number;
  extreme_outlier?: boolean;
  influential?: boolean;
}

interface OutlierSummary {
  threshold?: number;
  cooks_threshold?: number;
  std_residual_threshold?: number;
  n_extreme_outliers?: number;
  n_influential_observations?: number;
}

interface PerGenotypeStat {
  genotype?: string;
  treatment?: string;
  min?: number;
  q1?: number;
  median?: number;
  q3?: number;
  max?: number;
}

export interface AssumptionDiagnosticsProps {
  assumption_tests?: AssumptionTests | null;
  diagnostic_observations?: DiagnosticObservation[] | null;
  diagnostic_plots?: {
    residuals_vs_treatment?: unknown;
    scale_location?: unknown;
    cooks_distance?: Array<{ observation?: number | string; cooks_distance?: number; treatment?: string }> | null;
    standardized_residual?: unknown;
  } | null;
  standardized_residuals?: number[] | null;
  cooks_distance?: number[] | null;
  outlier_summary?: OutlierSummary | null;
  per_genotype_stats?: PerGenotypeStat[] | null;
}

/* ---------- Helpers ---------- */

const fmt = (v: number | undefined | null, d = 3) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d);
const fmtP = (p: number | undefined | null) =>
  p == null || Number.isNaN(p) ? "—" : p < 0.001 ? "<0.001" : p.toFixed(3);

function PassFailBadge({ passed }: { passed?: boolean }) {
  if (passed === true)
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Pass
      </Badge>
    );
  if (passed === false)
    return (
      <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
        <AlertTriangle className="w-3 h-3 mr-1" /> Review
      </Badge>
    );
  return <Badge variant="outline">—</Badge>;
}

/* ---------- Charts ---------- */

function BoxPlot({ data }: { data: PerGenotypeStat[] }) {
  const labels = data.map((d) => String(d.genotype ?? d.treatment ?? ""));
  const vals = data.flatMap((d) => [d.min, d.q1, d.median, d.q3, d.max].filter((v): v is number => v != null));
  if (!vals.length) return null;
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const pad = (maxV - minV) * 0.08 || 1;
  const yMin = minV - pad;
  const yMax = maxV + pad;
  const W = 640, H = 280, ML = 48, MR = 12, MT = 10, MB = 56;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const xStep = plotW / Math.max(data.length, 1);
  const boxW = Math.min(40, xStep * 0.55);
  const yScale = (v: number) => MT + ((yMax - v) / (yMax - yMin)) * plotH;

  const ticks = 5;
  const tickVals = Array.from({ length: ticks }, (_, i) => yMin + ((yMax - yMin) * i) / (ticks - 1));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[280px]" preserveAspectRatio="xMidYMid meet">
        {/* y grid */}
        {tickVals.map((t, i) => (
          <g key={i}>
            <line x1={ML} x2={W - MR} y1={yScale(t)} y2={yScale(t)} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <text x={ML - 6} y={yScale(t) + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {/* boxes */}
        {data.map((d, i) => {
          const cx = ML + xStep * (i + 0.5);
          if (d.q1 == null || d.q3 == null || d.median == null) return null;
          const yQ1 = yScale(d.q1);
          const yQ3 = yScale(d.q3);
          const yMed = yScale(d.median);
          const yMinD = d.min != null ? yScale(d.min) : yQ1;
          const yMaxD = d.max != null ? yScale(d.max) : yQ3;
          return (
            <g key={i}>
              {/* whiskers */}
              <line x1={cx} x2={cx} y1={yMaxD} y2={yQ3} stroke="hsl(var(--primary))" />
              <line x1={cx} x2={cx} y1={yQ1} y2={yMinD} stroke="hsl(var(--primary))" />
              <line x1={cx - boxW / 3} x2={cx + boxW / 3} y1={yMaxD} y2={yMaxD} stroke="hsl(var(--primary))" />
              <line x1={cx - boxW / 3} x2={cx + boxW / 3} y1={yMinD} y2={yMinD} stroke="hsl(var(--primary))" />
              {/* box */}
              <rect
                x={cx - boxW / 2}
                y={yQ3}
                width={boxW}
                height={Math.max(yQ1 - yQ3, 1)}
                fill="hsl(var(--primary) / 0.15)"
                stroke="hsl(var(--primary))"
              />
              {/* median */}
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMed} y2={yMed} stroke="hsl(var(--primary))" strokeWidth={2} />
              {/* label */}
              <text x={cx} y={H - MB + 14} textAnchor="end" fontSize="10" fill="hsl(var(--foreground))" transform={`rotate(-35 ${cx} ${H - MB + 14})`}>
                {labels[i]}
              </text>
            </g>
          );
        })}
        {/* axes */}
        <line x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} stroke="hsl(var(--border))" />
        <line x1={ML} x2={ML} y1={MT} y2={H - MB} stroke="hsl(var(--border))" />
      </svg>
    </div>
  );
}

class BoxPlotErrorBoundary extends Component<
  { data: PerGenotypeStat[]; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { data: PerGenotypeStat[]; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error("BoxPlot render failed, showing fallback table:", err);
  }
  render() {
    if (this.state.hasError) return <BoxPlotFallbackTable data={this.props.data} />;
    return this.props.children;
  }
}

function BoxPlotFallbackTable({ data }: { data: PerGenotypeStat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Treatment</th>
            <th className="px-3 py-2 font-medium text-right">Min</th>
            <th className="px-3 py-2 font-medium text-right">Q1</th>
            <th className="px-3 py-2 font-medium text-right">Median</th>
            <th className="px-3 py-2 font-medium text-right">Q3</th>
            <th className="px-3 py-2 font-medium text-right">Max</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{d.genotype ?? d.treatment ?? "—"}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.min, 2)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.q1, 2)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.median, 2)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.q3, 2)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.max, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SafeBoxPlot({ data }: { data: PerGenotypeStat[] }) {
  try {
    const valid = data.filter((d) => d.q1 != null && d.q3 != null && d.median != null);
    if (!valid.length) return <BoxPlotFallbackTable data={data} />;
    return (
      <BoxPlotErrorBoundary data={data}>
        <BoxPlot data={valid} />
      </BoxPlotErrorBoundary>
    );
  } catch (err) {
    console.error("SafeBoxPlot error:", err);
    return <BoxPlotFallbackTable data={data} />;
  }
}

function ResidualHistogram({ residuals }: { residuals: number[] }) {
  const bins = useMemo(() => {
    if (!residuals.length) return [] as { bin: string; count: number }[];
    const min = Math.min(...residuals);
    const max = Math.max(...residuals);
    const n = Math.min(20, Math.max(6, Math.round(Math.sqrt(residuals.length))));
    const w = (max - min) / n || 1;
    const buckets = Array.from({ length: n }, (_, i) => ({
      bin: (min + w * (i + 0.5)).toFixed(2),
      count: 0,
    }));
    residuals.forEach((r) => {
      const idx = Math.min(n - 1, Math.floor((r - min) / w));
      buckets[idx].count++;
    });
    return buckets;
  }, [residuals]);
  if (!bins.length) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={bins} margin={{ top: 10, right: 12, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="bin" tick={{ fontSize: 10 }} label={{ value: "Residual", position: "insideBottom", offset: -6, fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} label={{ value: "Count", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="hsl(var(--primary))" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ResidualVsFitted({ obs }: { obs: DiagnosticObservation[] }) {
  const data = obs
    .filter((o) => o.fitted != null && o.residual != null)
    .map((o) => ({ x: o.fitted as number, y: o.residual as number, outlier: !!o.extreme_outlier }));
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ScatterChart margin={{ top: 10, right: 12, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" dataKey="x" tick={{ fontSize: 10 }} label={{ value: "Fitted", position: "insideBottom", offset: -6, fontSize: 11 }} />
        <YAxis type="number" dataKey="y" tick={{ fontSize: 10 }} label={{ value: "Residual", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <ZAxis range={[40, 40]} />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data} fill="hsl(var(--primary))">
          {data.map((d, i) => (
            <Cell key={i} fill={d.outlier ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function CooksPlot({
  data,
  threshold,
}: {
  data: Array<{ observation?: number | string; cooks_distance?: number }>;
  threshold?: number;
}) {
  const rows = data
    .filter((d) => d.cooks_distance != null)
    .map((d, i) => ({ obs: String(d.observation ?? i + 1), cooks: d.cooks_distance as number }));
  if (!rows.length) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="obs" tick={{ fontSize: 9 }} interval="preserveStartEnd" label={{ value: "Observation", position: "insideBottom", offset: -6, fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} label={{ value: "Cook's D", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip />
        {threshold != null && (
          <ReferenceLine y={threshold} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `threshold ${threshold.toFixed(3)}`, fill: "hsl(var(--destructive))", fontSize: 10, position: "right" }} />
        )}
        <Bar dataKey="cooks" fill="hsl(var(--primary))">
          {rows.map((r, i) => (
            <Cell key={i} fill={threshold != null && r.cooks > threshold ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- Main section ---------- */

export function AssumptionDiagnosticsSection(props: AssumptionDiagnosticsProps) {
  const {
    assumption_tests,
    diagnostic_observations,
    diagnostic_plots,
    standardized_residuals,
    cooks_distance,
    outlier_summary,
    per_genotype_stats,
  } = props;

  const [chartsOpen, setChartsOpen] = useState(false);

  const hasAnything =
    !!assumption_tests ||
    !!(diagnostic_observations && diagnostic_observations.length) ||
    !!(per_genotype_stats && per_genotype_stats.length) ||
    !!(standardized_residuals && standardized_residuals.length) ||
    !!(cooks_distance && cooks_distance.length);
  if (!hasAnything) return null;

  const reviewer = assumption_tests?.reviewer_mode;
  const status = reviewer?.status?.toUpperCase();
  const isPass = status === "PASS" || (status == null && assumption_tests?.overall?.passed === true);
  const isWarn = status === "WARN" || (status == null && assumption_tests?.overall?.passed === false);

  const bannerHeadline = isPass
    ? "Assumptions satisfied"
    : isWarn
    ? "Review recommended"
    : "Assumption diagnostics";
  const bannerSummary =
    reviewer?.summary ??
    (isPass
      ? "ANOVA results can be interpreted with confidence."
      : isWarn
      ? "One or more model assumptions warrant a closer look before interpretation."
      : "");

  const bannerClass = isPass
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : isWarn
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : "border-muted bg-muted/30 text-foreground";
  const BannerIcon = isPass ? CheckCircle2 : isWarn ? AlertTriangle : ShieldCheck;

  const normality = assumption_tests?.normality;
  const homogeneity = assumption_tests?.homogeneity;
  const showTests = !!(normality || homogeneity);

  // Build residuals array for histogram (prefer standardized_residuals → diagnostic_observations.residual)
  const residualsArr: number[] =
    (standardized_residuals && standardized_residuals.length
      ? standardized_residuals
      : diagnostic_observations
          ?.map((o) => o.residual)
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v))) ?? [];

  const obsArr = diagnostic_observations ?? [];
  const hasResVsFit = obsArr.some((o) => o.fitted != null && o.residual != null);

  // Resolve per-genotype stats: prop, else compute from diagnostic_observations (observed grouped by treatment)
  const quantile = (sorted: number[], q: number) => {
    if (!sorted.length) return undefined;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] !== undefined
      ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
      : sorted[base];
  };
  const computedBoxStats: PerGenotypeStat[] = useMemo(() => {
    if (per_genotype_stats && per_genotype_stats.length) return per_genotype_stats;
    const groups = new Map<string, number[]>();
    obsArr.forEach((o) => {
      const key = String(o.treatment ?? "");
      const val = typeof o.observed === "number" ? o.observed : undefined;
      if (!key || val == null || Number.isNaN(val)) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(val);
    });
    return Array.from(groups.entries())
      .map(([genotype, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return {
          genotype,
          min: sorted[0],
          q1: quantile(sorted, 0.25),
          median: quantile(sorted, 0.5),
          q3: quantile(sorted, 0.75),
          max: sorted[sorted.length - 1],
        };
      })
      .filter((s) => s.min != null);
  }, [per_genotype_stats, obsArr]);

  // Cook's distance source
  const cooksSource: Array<{ observation?: number | string; cooks_distance?: number }> =
    (diagnostic_plots?.cooks_distance && diagnostic_plots.cooks_distance.length
      ? diagnostic_plots.cooks_distance
      : cooks_distance && cooks_distance.length
      ? cooks_distance.map((c, i) => ({ observation: i + 1, cooks_distance: c }))
      : obsArr
          .filter((o) => o.cooks_distance != null)
          .map((o) => ({ observation: o.observation, cooks_distance: o.cooks_distance }))) ?? [];

  const cooksThreshold = outlier_summary?.cooks_threshold ?? outlier_summary?.threshold;

  const flagged = obsArr.filter((o) => o.extreme_outlier || o.influential);
  const showFlagged =
    flagged.length > 0 ||
    (outlier_summary &&
      ((outlier_summary.n_extreme_outliers ?? 0) > 0 || (outlier_summary.n_influential_observations ?? 0) > 0));

  const chartCount = [
    computedBoxStats.length > 0,
    residualsArr.length > 0,
    hasResVsFit,
    cooksSource.length > 0,
  ].filter(Boolean).length;

  const summaryLine = isPass
    ? "✓ Assumptions satisfied — click to view diagnostics"
    : isWarn
    ? "⚠ Review recommended — click to view diagnostics"
    : "Assumption diagnostics — click to view details";

  return (
    <VsResultSection
      title="Assumption Diagnostics"
      eyebrow="Model adequacy"
      description={summaryLine}
      defaultOpen={true}
    >
      <div className="space-y-5">
        {/* Status banner */}
        <Card className={`border ${bannerClass}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BannerIcon className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{bannerHeadline}</p>
                {bannerSummary && <p className="text-sm opacity-90 mt-0.5">{bannerSummary}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tests table */}
        {showTests && (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Test</th>
                    <th className="px-4 py-2 font-medium text-right">Statistic</th>
                    <th className="px-4 py-2 font-medium text-right">p-value</th>
                    <th className="px-4 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {normality && (
                    <tr className="border-t">
                      <td className="px-4 py-2">Shapiro–Wilk (Normality)</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(normality.statistic)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtP(normality.p_value)}</td>
                      <td className="px-4 py-2"><PassFailBadge passed={normality.passed} /></td>
                    </tr>
                  )}
                  {homogeneity && (
                    <tr className="border-t">
                      <td className="px-4 py-2">Levene (Homogeneity)</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(homogeneity.statistic)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtP(homogeneity.p_value)}</td>
                      <td className="px-4 py-2"><PassFailBadge passed={homogeneity.passed} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Charts toggle */}
        {chartCount > 0 && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setChartsOpen((v) => !v)}>
              {chartsOpen ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
              {chartsOpen ? "Hide diagnostic plots" : `Show diagnostic plots (${chartCount})`}
            </Button>

            {chartsOpen && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {computedBoxStats.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-serif font-semibold text-sm mb-2">Treatment Boxplots</p>
                      <SafeBoxPlot data={computedBoxStats} />
                    </CardContent>
                  </Card>
                )}
                {residualsArr.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-serif font-semibold text-sm mb-2">Residual Histogram</p>
                      <ResidualHistogram residuals={residualsArr} />
                    </CardContent>
                  </Card>
                )}
                {hasResVsFit && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-serif font-semibold text-sm mb-2">Residuals vs Fitted</p>
                      <ResidualVsFitted obs={obsArr} />
                    </CardContent>
                  </Card>
                )}
                {cooksSource.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-serif font-semibold text-sm mb-2">Cook's Distance</p>
                      <CooksPlot data={cooksSource} threshold={cooksThreshold} />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Flagged observations */}
        {showFlagged && flagged.length > 0 && (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-medium">Flagged observations ({flagged.length})</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Obs</th>
                    <th className="px-4 py-2 font-medium">Treatment</th>
                    <th className="px-4 py-2 font-medium">Block</th>
                    <th className="px-4 py-2 font-medium text-right">Std. Residual</th>
                    <th className="px-4 py-2 font-medium text-right">Cook's D</th>
                    <th className="px-4 py-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((o, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2 font-mono">{o.observation ?? i + 1}</td>
                      <td className="px-4 py-2">{o.treatment ?? "—"}</td>
                      <td className="px-4 py-2">{o.block ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(o.standardized_residual)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(o.cooks_distance, 4)}</td>
                      <td className="px-4 py-2 space-x-1">
                        {o.extreme_outlier && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">Outlier</Badge>
                        )}
                        {o.influential && (
                          <Badge className="bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-100">Influential</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </VsResultSection>
  );
}
