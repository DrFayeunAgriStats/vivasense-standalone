import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerificationBanner, NoticeList } from "../AnalysisStatus";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";
import { ArrowUpDown } from "lucide-react";
import { fmt, InterpretationPanel, ExportToolbar, downloadCsv, exportChartPng } from "../shared";
import type { StabilityResponse, StabilityRow } from "@/types/advancedAnalysis";
import { classicCsvRows, flagDisplay, pCellText } from "./interpretation";

type SortKey = "rank" | "genotype" | "mean" | "bi" | "s2di" | "shukla_variance" | "ecovalence";

const CLASS_BADGE: Record<string, string> = {
  // neutral on purpose: "not rejected" must not be coloured as "good" (green would read as a validated stability verdict)
  stable: "bg-muted text-muted-foreground border-border",
  responsive_favorable: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200",
  responsive: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200",
  responsive_poor: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200",
  unpredictable: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200",
};
function classBadge(r: StabilityRow) {
  // fail-safe: without the provisional metadata the badge is neutral whatever the class identifier says
  return flagDisplay(r).tone === "unknown" ? "bg-muted text-muted-foreground border-border" : (CLASS_BADGE[r.stability_class] ?? "bg-muted text-muted-foreground border-border");
}
function classColor(c: string): string {
  if (c === "stable") return "hsl(var(--muted-foreground))";
  if (c.startsWith("responsive_fav") || c === "responsive") return "hsl(217 91% 55%)";
  if (c === "responsive_poor") return "hsl(25 95% 53%)";
  if (c === "unpredictable") return "hsl(0 84% 55%)";
  return "hsl(var(--muted-foreground))";
}

export function ClassicTab({ result }: { result: StabilityResponse }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  const allRows: StabilityRow[] = useMemo(
    () => (Array.isArray(result?.genotype_stability) ? result.genotype_stability.filter(Boolean) : []),
    [result]
  );
  // best_stable_genotypes is DEPRECATED (always empty): the neutral, mean-independent list is shown instead.
  const bestSet = useMemo(
    () => new Set(Array.isArray(result?.genotypes_not_flagged) ? result.genotypes_not_flagged : []),
    [result]
  );

  const sortedRows: StabilityRow[] = useMemo(() => {
    const arr = [...allRows];
    arr.sort((a, b) => {
      const av = a[sortKey] as number | string | undefined;
      const bv = b[sortKey] as number | string | undefined;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [allRows, sortKey, sortAsc]);

  const scatterData = useMemo(() => {
    const maxS2 = Math.max(...allRows.map((g) => Math.abs(g.s2di ?? 0)), 1e-9);
    return allRows.map((g) => ({
      genotype: g.genotype,
      x: g.bi,
      y: g.mean,
      // Inverse stability → larger circle = more stable (lower s2di)
      z: Math.max(40, 320 * (1 - Math.min(1, Math.abs(g.s2di ?? 0) / maxS2))),
      cls: flagDisplay(g).tone === "unknown" ? "unlabelled" : g.stability_class,
      s2di: g.s2di,
      shukla: g.shukla_variance,
      isBest: bestSet.has(g.genotype),
    }));
  }, [allRows, bestSet]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof scatterData>();
    scatterData.forEach((d) => {
      const arr = map.get(d.cls) ?? [];
      arr.push(d);
      map.set(d.cls, arr);
    });
    return Array.from(map.entries());
  }, [scatterData]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  return (
    <div className="space-y-6">
      <VerificationBanner
        status={result.stability_verification?.status ?? null}
        reasons={result.stability_verification?.reasons}
        subject="This stability result"
      />
      <NoticeList title="Statistical cautions (read before interpreting the classes)" items={result.stability_assumptions?.cautions} tone="amber" />
      {result.stability_assumptions?.primary_b_test && (
        <NoticeList title="Provisional classification" items={[result.stability_assumptions.primary_b_test.note]} tone="blue" />
      )}
      <InterpretationPanel text={result.interpretation} verbatim title="Interpretation (rule-based and descriptive)" />

      {result.stability_assumptions && (
        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Design assumptions used</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1 text-muted-foreground">
            <p>Design: <span className="font-medium text-foreground">{result.stability_assumptions.design === "unspecified" ? "not specified as RCBD or CRD" : result.stability_assumptions.design.toUpperCase()}</span>
              {" · "}replicates per cell: <span className="font-medium text-foreground">{result.stability_assumptions.replicates ?? "—"}</span>
              {" · "}pooled error MS: <span className="font-medium text-foreground">{result.stability_assumptions.mse != null ? fmt(result.stability_assumptions.mse, 4) : "not available"}</span>
              {result.stability_assumptions.df_error != null && <> ({result.stability_assumptions.df_error} df)</>}</p>
            {!result.stability_assumptions.pooled_error_available && result.stability_assumptions.pooled_error_reason && (
              <p className="text-amber-700">{result.stability_assumptions.pooled_error_reason} S²<sub>di</sub> is therefore shown unadjusted and no tests or classification are given.</p>
            )}
            {result.stability_assumptions.bartlett && (
              <p>Homogeneity of environment error variances (Bartlett): χ² = {fmt(result.stability_assumptions.bartlett.statistic, 2)}, p = {fmt(result.stability_assumptions.bartlett.p_value, 3)}
                {result.stability_assumptions.bartlett.p_value < 0.05 && <span className="text-amber-700"> — error variances differ; the pooled error may not suit every genotype.</span>}</p>
            )}
            <p>Complete genotype × environment table required (missing cells are refused, never imputed). The environmental index is calculated from the same data.</p>
          </CardContent>
        </Card>
      )}

      {/* Scatter: mean vs bi */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-lg">Mean × b<sub>i</sub> stability scatter</CardTitle>
          <ExportToolbar onPng={() => exportChartPng(chartRef.current, `stability_scatter_${result.trait}.png`)} />
        </CardHeader>
        <CardContent>
          <div ref={chartRef} className="w-full h-[460px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 30, bottom: 36, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number" dataKey="x" name="bi" domain={["auto", "auto"]}
                  label={{ value: "Regression coefficient (bᵢ)", position: "insideBottom", offset: -16 }}
                />
                <YAxis
                  type="number" dataKey="y" name="Mean"
                  label={{ value: `Mean ${result.trait}`, angle: -90, position: "insideLeft" }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 320]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as typeof scatterData[number];
                    return (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <div className="font-semibold">{d.genotype}</div>
                        <div>Mean: {fmt(d.y, 2)}</div>
                        <div>bᵢ: {fmt(d.x, 3)}</div>
                        <div>S²di: {fmt(d.s2di, 3)}</div>
                        {d.shukla != null && <div>Shukla σ²: {fmt(d.shukla, 3)}</div>}
                        <div className="mt-1 text-muted-foreground">{d.cls === "stable" ? "not flagged (exploratory; not evidence of stability)" : d.cls === "unlabelled" ? "classification not shown" : `${d.cls} (exploratory)`}</div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <ReferenceLine x={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "bᵢ=1", position: "top" }} />
                <ReferenceLine y={result.grand_mean} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "Grand mean", position: "right" }} />
                {groups.map(([cls, points]) => (
                  <Scatter key={cls} name={cls === "stable" ? "not flagged (exploratory)" : cls === "unlabelled" ? "classification not shown" : `${cls} (exploratory)`} data={points} fill={classColor(cls)} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Larger circles indicate a smaller deviation from regression (smaller |S²<sub>di</sub>|). Descriptive display of the tested genotypes only; it does not rank varieties.
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-lg">Per-genotype stability</CardTitle>
          <ExportToolbar
            onCsv={() => downloadCsv(`stability_${result.trait}.csv`, classicCsvRows(result.genotype_stability))}
            onCopy={() => navigator.clipboard.writeText(result.interpretation)}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortBtn k="genotype" cur={sortKey} asc={sortAsc} onClick={toggleSort}>Genotype</SortBtn></TableHead>
                <TableHead className="text-right"><SortBtn k="mean" cur={sortKey} asc={sortAsc} onClick={toggleSort}>Mean</SortBtn></TableHead>
                <TableHead className="text-right"><SortBtn k="bi" cur={sortKey} asc={sortAsc} onClick={toggleSort}>bᵢ</SortBtn></TableHead>
                <TableHead className="text-right"><SortBtn k="s2di" cur={sortKey} asc={sortAsc} onClick={toggleSort}>S²<sub>di</sub></SortBtn></TableHead>
                <TableHead className="text-right"><SortBtn k="shukla_variance" cur={sortKey} asc={sortAsc} onClick={toggleSort}>Shukla σ²</SortBtn></TableHead>
                <TableHead className="text-right"><SortBtn k="ecovalence" cur={sortKey} asc={sortAsc} onClick={toggleSort}>Wricke W<sub>i</sub></SortBtn></TableHead>
                <TableHead className="text-right">b<sub>i</sub> 95% CI</TableHead>
                <TableHead className="text-right" title="Own-deviation standard error (drives the class; provisional)">p (b=1), own SE</TableHead>
                <TableHead className="text-right" title="Pooled-error standard error (metan convention)">p (b=1), pooled SE</TableHead>
                <TableHead className="text-right">p (S²<sub>di</sub>=0)</TableHead>
                <TableHead className="text-right"><SortBtn k="rank" cur={sortKey} asc={sortAsc} onClick={toggleSort}>Rank by mean</SortBtn></TableHead>
                <TableHead title="Exploratory and provisional: the primary b test is pending independent statistical review. A genotype that is not flagged has not been shown to be stable or equivalent to the average.">Exploratory flag (provisional)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r) => {
                const isBest = bestSet.has(r.genotype);
                return (
                  <TableRow key={r.genotype} className="">
                    <TableCell className="font-medium">
                      {r.genotype}
                      {isBest && <Badge variant="outline" className="ml-2 text-[10px]" title="b = 1 and S²d = 0 were not rejected. This is absence of evidence of deviation, not evidence of stability or equivalence, and says nothing about the mean.">not flagged by the tests</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.mean, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.bi, 3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.s2di, 3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.shukla_variance != null ? fmt(r.shukla_variance, 3) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.ecovalence != null ? fmt(r.ecovalence, 3) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.b_ci_low != null && r.b_ci_high != null ? `${fmt(r.b_ci_low, 2)} – ${fmt(r.b_ci_high, 2)}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{pCellText(r.b_p_vs_1, r.b_inference_status, fmt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.b_p_pooled != null ? fmt(r.b_p_pooled, 3) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.s2di_p != null ? fmt(r.s2di_p, 3) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.rank}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={classBadge(r)} title={flagDisplay(r).title}>
                        {flagDisplay(r).label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SortBtn({
  k, cur, asc, onClick, children,
}: { k: SortKey; cur: SortKey; asc: boolean; onClick: (k: SortKey) => void; children: React.ReactNode }) {
  const active = cur === k;
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-50"}`} />
      {active && <span className="sr-only">{asc ? "ascending" : "descending"}</span>}
    </button>
  );
}
