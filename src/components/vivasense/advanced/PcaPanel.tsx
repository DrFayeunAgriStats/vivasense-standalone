import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Loader2, Play, AlertTriangle, Compass, FileJson } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { runPca } from "@/lib/advancedAnalysisApi";
import { VerificationBanner, NoticeList, type VerificationScope } from "./AnalysisStatus";
import { recordAnalysis, recordAnalysisFailure } from "@/services/history/historyService";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { PcaResponse } from "@/types/advancedAnalysis";
import {
  fmt, SummaryCard, InterpretationPanel, ExportToolbar, downloadCsv, exportChartPng, DatasetTokenWarning,
} from "./shared";
import { downloadJson } from "@/lib/exportFiles";
import { buildBiplot, type BiplotConvention } from "@/lib/pcaBiplot";
import { buildPcaManifest, pcaLoadingsCsvRows, pcaScoresCsvRows } from "@/lib/pcaManifest";
import { PcaBiplot } from "./PcaBiplot";

interface Props { datasetContext: DatasetContext | null; }

/** Explicit colours: CSS variables inside SVG presentation attributes are lost in PNG export (Manus PCA audit D13). */
const SCREE_BAR = "#0A7F5A";
const SCREE_LINE = "#1D4ED8";

/** A completed run, bound to the dataset it was computed for (Manus PCA audit D01). */
interface CompletedRun {
  datasetToken: string;
  datasetName: string | null;
  request: Record<string, unknown>;
  response: PcaResponse;
  completedAt: string;
}

export function PcaPanel({ datasetContext }: Props) {
  const { toast } = useToast();
  const allTraits = useMemo(() => datasetContext?.availableTraitColumns ?? [], [datasetContext]);
  const datasetToken = datasetContext?.datasetToken ?? null;
  const [traits, setTraits] = useState<string[]>(allTraits);
  const [standardize, setStandardize] = useState(true);
  // Researcher authorisation, OFF by default: otherwise missing means / constant traits REFUSE the analysis and nothing is dropped.
  const [allowExcludeGenotypes, setAllowExcludeGenotypes] = useState(false);
  const [allowExcludeTraits, setAllowExcludeTraits] = useState(false);
  const [nComponents, setNComponents] = useState<number>(0); // 0 = let backend decide (sent as null)
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedRun | null>(null);
  const [pcA, setPcA] = useState(0); // index 0 = PC1
  const [pcB, setPcB] = useState(1); // index 1 = PC2
  const [convention, setConvention] = useState<BiplotConvention>("correlation");
  const screeRef = useRef<HTMLDivElement>(null);
  const biplotRef = useRef<HTMLDivElement>(null);
  // Generation of the dataset-bound state. Any dataset change (or a newer run) invalidates in-flight requests.
  const generationRef = useRef(0);

  // D01: every dataset-bound piece of state is reset when the dataset identity or token changes.
  useEffect(() => {
    generationRef.current += 1;
    setTraits(allTraits);
    setStandardize(true);
    setAllowExcludeGenotypes(false);
    setAllowExcludeTraits(false);
    setNComponents(0);
    setIsRunning(false);
    setError(null);
    setCompleted(null);
    setPcA(0);
    setPcB(1);
  }, [datasetToken, datasetContext, allTraits]);

  // Render-time guard as well as the reset: a result is shown only for the dataset it belongs to.
  const run = completed && completed.datasetToken === datasetToken ? completed : null;
  const result = run?.response ?? null;

  const handleRun = async () => {
    if (!datasetToken) return toast({ title: "Dataset required" });
    // Only traits of the CURRENT dataset can be requested (never an obsolete selection).
    const requested = traits.filter((t) => allTraits.includes(t));
    if (requested.length < 2) return toast({ title: "Pick at least 2 traits", description: "PCA needs ≥2 variables." });
    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    setIsRunning(true);
    setError(null);
    setCompleted(null);
    const request = {
      dataset_token: datasetToken,
      trait_columns: requested,
      scale: standardize,
      n_components: nComponents > 0 ? nComponents : null,
      on_missing: allowExcludeGenotypes ? "exclude_genotypes" as const : "refuse" as const,
      on_zero_variance: allowExcludeTraits ? "exclude_traits" as const : "refuse" as const,
    };
    // Hoisted so the failure path reports the same fields and elapsed time.
    const startedAt = performance.now();
    const historyBase = {
      analysisType: "pca" as const,
      backendEndpoint: "/analysis/pca",
      datasetName: datasetContext?.file?.name ?? null,
      datasetToken,
      traits: requested,
      startedAt,
      parameters: {
        scale: standardize, n_components: request.n_components,
        on_missing: request.on_missing, on_zero_variance: request.on_zero_variance,
      },
    };
    try {
      const res = await runPca(request);
      if (res.status !== "success") throw new Error("PCA failed on the server.");
      if (!isCurrent()) return;           // the dataset or run changed while this request was in flight
      setCompleted({
        datasetToken, datasetName: datasetContext?.file?.name ?? null, request, response: res,
        completedAt: new Date().toISOString(),
      });
      void recordAnalysis({ ...historyBase, response: res });
      setPcA(0);
      setPcB(Math.min(1, res.variance_explained.length - 1));
      toast({ title: "PCA complete", description: `${res.n_traits} traits × ${res.n_genotypes} genotypes` });
    } catch (e) {
      if (!isCurrent()) return;
      const msg = (e as Error).message ?? "Unexpected error";
      void recordAnalysisFailure(historyBase, msg);
      setError(msg);
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      if (isCurrent()) setIsRunning(false);
    }
  };

  // Detect whether backend returns proportions (0..1) or percentages (0..100)
  const varScale = useMemo(() => {
    if (!result) return 1;
    const maxV = Math.max(...result.variance_explained, ...(result.cumulative_variance ?? [0]));
    return maxV > 1 ? 1 : 100;
  }, [result]);
  const toPct = (v: number) => v * varScale;

  const screeData = useMemo(() => {
    if (!result) return [];
    return result.variance_explained.map((v, i) => ({
      pc: `PC${i + 1}`,
      variance: v * varScale,
      cumulative: (result.cumulative_variance[i] ?? 0) * varScale,
    }));
  }, [result, varScale]);

  const nPCs = result?.variance_explained.length ?? 0;
  const geometry = useMemo(() => {
    if (!result) return null;
    return buildBiplot(
      { ...result, variance_explained: result.variance_explained.map((v) => v * varScale) },
      pcA, pcB, convention,
    );
  }, [result, pcA, pcB, convention, varScale]);

  const toggleTrait = (t: string) => {
    setTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  // D12: the two biplot axes are always different components.
  const chooseA = (i: number) => { setPcA(i); if (i === pcB) setPcB(pcA); };
  const chooseB = (i: number) => { setPcB(i); if (i === pcA) setPcA(pcB); };

  const manifest = () => run && buildPcaManifest(run, {
    biplot: geometry ? {
      convention: geometry.convention, components: [geometry.a + 1, geometry.b + 1], arrow_display_factor: geometry.arrowScale,
      vectors: geometry.vectorKind, points: geometry.pointKind, description: geometry.description,
    } : null,
  });

  if (!datasetToken) return <DatasetTokenWarning />;

  return (
    <div className="space-y-6" data-testid="pca-panel" data-dataset-token={datasetToken}>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" /> Principal Component Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reduce trait dimensionality and reveal multivariate patterns of genotype variation.
          </p>
          <div>
            <Label className="text-xs uppercase tracking-wide block mb-2">Traits</Label>
            <div className="flex flex-wrap gap-2">
              {allTraits.map((t) => {
                const checked = traits.includes(t);
                return (
                  <label key={t} className={`px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${checked ? "bg-primary/10 border-primary text-foreground" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleTrait(t)} aria-label={`Trait ${t}`} />
                    {t}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={allowExcludeGenotypes} onCheckedChange={(v) => setAllowExcludeGenotypes(!!v)} />
              <span>I authorise excluding genotypes with a missing trait mean (listed in the results). Off: the analysis is refused instead.</span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={allowExcludeTraits} onCheckedChange={(v) => setAllowExcludeTraits(!!v)} />
              <span>I authorise excluding constant (zero-variance) traits (listed in the results). Off: the analysis is refused instead.</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={standardize} onCheckedChange={(v) => setStandardize(!!v)} />
              Standardize traits (z-score)
            </label>
            <div>
              <Label className="text-xs uppercase tracking-wide">Number of PCs (0 = auto)</Label>
              <div className="flex items-center gap-3">
                <Slider value={[nComponents]} max={Math.max(2, allTraits.length)} step={1} onValueChange={(v) => setNComponents(v[0])} className="flex-1" aria-label="Number of principal components" />
                <span className="text-sm tabular-nums w-8 text-right">{nComponents || "auto"}</span>
              </div>
            </div>
            <Button onClick={handleRun} disabled={isRunning || traits.length < 2} className="gap-2">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Analysis
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5" role="alert">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {isRunning && <Skeleton className="h-72" />}

      {result && run && (
        <div className="space-y-6" data-testid="pca-result" data-result-dataset-token={run.datasetToken}>
          <VerificationBanner status={result.verification_status ?? null} reasons={result.verification_reasons} subject="This PCA result"
            scope={(result.verification_coverage?.verification_scope as VerificationScope | undefined) ?? null} />
          <NoticeList title="Exclusions authorised by the researcher and data notes" items={result.input_notes} tone="amber" />
          <NoticeList title="Cautions" items={result.warnings} tone="amber" />
          {result.matrix && (
            <p className="text-xs text-muted-foreground">
              PCA of the {result.matrix} matrix of genotype means
              {run.datasetName ? <> for <span className="font-medium">{run.datasetName}</span></> : null}.{" "}
              {result.sign_convention ? `Component signs are arbitrary (${result.sign_convention}).` : ""}
            </p>
          )}
          <InterpretationPanel text={result.interpretation} verbatim title="Interpretation (descriptive)" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Traits" value={result.n_traits} />
            <SummaryCard label="Genotypes" value={result.n_genotypes} />
            <SummaryCard label="PC1 variance" value={`${toPct(result.variance_explained[0]).toFixed(1)}%`} accent="emerald" />
            {nPCs >= 2 && (
              <SummaryCard label="PC1+PC2" value={`${toPct(result.cumulative_variance[1]).toFixed(1)}%`} accent="emerald" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadJson("pca_result_manifest.json", manifest())}>
              <FileJson className="h-3.5 w-3.5" /> Download result manifest (JSON)
            </Button>
            <span className="text-xs text-muted-foreground">
              Full-precision results with dataset, settings, exclusions, verification coverage and engine provenance. Keep it with the CSV and PNG exports.
            </span>
          </div>

          {/* Scree plot */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Scree plot</CardTitle>
              <ExportToolbar onPng={() => exportChartPng(screeRef.current, "pca_scree.png", { preserveAspectRatio: true })} />
            </CardHeader>
            <CardContent>
              <div ref={screeRef} className="w-full h-[300px]" data-testid="pca-scree">
                <ResponsiveContainer>
                  <ComposedChart data={screeData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pc" />
                    <YAxis yAxisId="l" label={{ value: "% variance", angle: -90, position: "insideLeft" }} />
                    <YAxis yAxisId="r" orientation="right" domain={[0, 100]} label={{ value: "Cumulative %", angle: 90, position: "insideRight" }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="l" dataKey="variance" name="Variance %" fill={SCREE_BAR} />
                    <Line yAxisId="r" dataKey="cumulative" name="Cumulative %" stroke={SCREE_LINE} strokeWidth={2} dot={{ fill: SCREE_LINE, stroke: SCREE_LINE }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Biplot (D07, D12) */}
          {geometry ? (
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="font-serif text-lg">Biplot (PC{geometry.a + 1} vs PC{geometry.b + 1})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={convention} onValueChange={(v) => setConvention(v as BiplotConvention)}>
                    <SelectTrigger className="w-52" aria-label="Biplot scaling"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="correlation">Correlation biplot</SelectItem>
                      <SelectItem value="distance">Distance biplot</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(geometry.a)} onValueChange={(v) => chooseA(Number(v))}>
                    <SelectTrigger className="w-28" aria-label="Horizontal component"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {result.variance_explained.map((_, i) => (
                        <SelectItem key={i} value={String(i)} disabled={i === geometry.b}>PC{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <Select value={String(geometry.b)} onValueChange={(v) => chooseB(Number(v))}>
                    <SelectTrigger className="w-28" aria-label="Vertical component"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {result.variance_explained.map((_, i) => (
                        <SelectItem key={i} value={String(i)} disabled={i === geometry.a}>PC{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ExportToolbar onPng={() => exportChartPng(biplotRef.current, "pca_biplot.png", { preserveAspectRatio: true })} />
                </div>
              </CardHeader>
              <CardContent>
                <div ref={biplotRef} className="w-full flex justify-center" data-testid="pca-biplot">
                  <PcaBiplot geometry={geometry} varianceExplained={result.variance_explained.map((v) => v * varScale)}
                    title={`PCA biplot: PC${geometry.a + 1} vs PC${geometry.b + 1}`} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="pca-biplot-unavailable">
              A biplot needs two components; this result has only {nPCs}.
            </p>
          )}

          {/* Loadings table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Trait loadings (eigenvector coefficients)</CardTitle>
              <div className="flex flex-wrap gap-2">
                <ExportToolbar onCsv={() => downloadCsv("pca_loadings.csv", pcaLoadingsCsvRows(result))} csvLabel="Download loadings" />
                <ExportToolbar onCsv={() => downloadCsv("pca_scores.csv", pcaScoresCsvRows(result))} csvLabel="Download scores" />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <p className="mb-2 text-xs text-muted-foreground">
                Unit-length eigenvector coefficients (directions of the components). These are not correlations; the correlation of each trait
                with each component is shown in the correlation biplot and included in the CSV and manifest. Values are shown to three decimals;
                downloads keep full precision.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trait</TableHead>
                    {result.variance_explained.map((_, i) => <TableHead key={i} className="text-right">PC{i + 1}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(result.loadings).map(([trait, vals]) => (
                    <TableRow key={trait}>
                      <TableCell className="font-medium">{trait}</TableCell>
                      {vals.map((v, i) => (
                        <TableCell key={i} className="text-right tabular-nums" style={{ background: loadingHeat(v) }}>{fmt(v, 3)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function loadingHeat(v: number): string {
  // map -1..1 → red..white..green at low alpha
  const a = Math.min(1, Math.abs(v));
  if (v >= 0) return `rgba(10, 127, 90, ${a * 0.22})`;
  return `rgba(220, 38, 38, ${a * 0.22})`;
}
