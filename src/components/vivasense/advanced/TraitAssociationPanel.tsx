import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Play, AlertTriangle, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { runTraitAssociation } from "@/lib/advancedAnalysisApi";
import { CorrelationHeatmap } from "@/components/vivasense/genetics-params/CorrelationHeatmap";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { TraitAssociationResponse, TraitAnalysisUnit } from "@/types/traitAssociation";
import {
  SummaryCard, InterpretationPanel, ExportToolbar, downloadCsv, DatasetTokenWarning,
} from "./shared";

interface Props { datasetContext: DatasetContext | null; }

const RISK_LABELS: Record<string, string> = {
  small_sample_size: "Small sample size",
  genotype_mean_based: "Genotype-mean based",
  plot_level_based: "Plot-level based",
  pairwise_n_not_tracked: "Pairwise N not tracked",
  multi_environment: "Multi-environment",
};

export function TraitAssociationPanel({ datasetContext }: Props) {
  const { toast } = useToast();
  const allTraits = datasetContext?.availableTraitColumns ?? [];
  const datasetToken = datasetContext?.datasetToken ?? null;

  const [traits, setTraits] = useState<string[]>(allTraits);
  const [analysisUnit, setAnalysisUnit] = useState<TraitAnalysisUnit>("genotype_mean");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraitAssociationResponse | null>(null);

  const toggleTrait = (t: string) =>
    setTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleRun = async () => {
    if (!datasetToken) return toast({ title: "Dataset required" });
    if (traits.length < 2) return toast({ title: "Pick at least 2 traits", description: "Association needs ≥2 traits." });
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runTraitAssociation({
        dataset_token: datasetToken,
        trait_columns: traits,
        analysis_unit: analysisUnit,
        alpha: 0.05,
        gxe_significant: false,
        environment_context: "single_environment",
      });
      if (!res || !Array.isArray(res.trait_names)) throw new Error("Unexpected response from server.");
      setResult(res);
      toast({ title: "Trait association complete", description: `${res.trait_names.length} traits · ${res.n_observations} observations` });
    } catch (e) {
      const msg = (e as Error).message ?? "Unexpected error";
      setError(msg);
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  // Convert the nested dictionaries into the 2-D arrays CorrelationHeatmap expects.
  const { rMatrix, pMatrix } = useMemo(() => {
    if (!result) return { rMatrix: [] as number[][], pMatrix: [] as (number | null)[][] };
    const names = result.trait_names;
    const rMatrix = names.map((a) => names.map((b) => result.correlation_matrix[a]?.[b] ?? 0));
    const pMatrix = names.map((a) => names.map((b) => result.pvalue_matrix[a]?.[b] ?? null));
    return { rMatrix, pMatrix };
  }, [result]);

  const matrixCsvRows = useMemo(() => {
    if (!result) return [];
    return result.trait_names.map((a) => ({
      trait: a,
      ...Object.fromEntries(result.trait_names.map((b) => [b, result.correlation_matrix[a]?.[b] ?? ""])),
    })) as Record<string, unknown>[];
  }, [result]);

  const pairColumns = useMemo(() => {
    if (!result || result.significant_pairs.length === 0) return [];
    return Object.keys(result.significant_pairs[0]);
  }, [result]);

  if (!datasetToken) return <DatasetTokenWarning />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Trait Association Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quantify trait–trait associations with a correlation and significance matrix, flag the
            strongest relationships, and surface data-quality risks for breeding interpretation.
          </p>

          <div>
            <Label className="text-xs uppercase tracking-wide block mb-2">Traits</Label>
            <div className="flex flex-wrap gap-2">
              {allTraits.map((t) => {
                const checked = traits.includes(t);
                return (
                  <label
                    key={t}
                    className={`px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                      checked
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-background border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleTrait(t)} />
                    {t}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-xs uppercase tracking-wide">Analysis unit</Label>
              <Select value={analysisUnit} onValueChange={(v) => setAnalysisUnit(v as TraitAnalysisUnit)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="genotype_mean">Genotype means</SelectItem>
                  <SelectItem value="plot_level">Plot level</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleRun} disabled={isRunning || traits.length < 2} className="gap-2">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Analysis
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {isRunning && <Skeleton className="h-72" />}

      {result && (
        <>
          {result.interpretation && <InterpretationPanel text={result.interpretation} />}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Traits" value={result.summary.num_traits} />
            <SummaryCard label="Observations" value={result.n_observations} />
            <SummaryCard label="Significant pairs" value={result.summary.num_significant_pairs} accent="emerald" />
            <SummaryCard label="Alpha" value={result.alpha} />
          </div>

          {result.risk_flags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Data-quality flags:</span>
              {result.risk_flags.map((f) => (
                <Badge key={f} variant="outline" className="text-[11px]">{RISK_LABELS[f] ?? f.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg">Correlation &amp; significance matrix</CardTitle>
              <ExportToolbar onCsv={() => downloadCsv("trait_association_matrix.csv", matrixCsvRows)} csvLabel="Download matrix" />
            </CardHeader>
            <CardContent>
              <CorrelationHeatmap traits={result.trait_names} rMatrix={rMatrix} pMatrix={pMatrix} />
              {(result.summary.strongest_positive_pair_label || result.summary.strongest_negative_pair_label) && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {result.summary.strongest_positive_pair_label && (
                    <div><span className="text-muted-foreground">Strongest positive: </span>
                      <span className="font-medium text-emerald-600">{result.summary.strongest_positive_pair_label}</span></div>
                  )}
                  {result.summary.strongest_negative_pair_label && (
                    <div><span className="text-muted-foreground">Strongest negative: </span>
                      <span className="font-medium text-red-600">{result.summary.strongest_negative_pair_label}</span></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {result.significant_pairs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-serif text-lg">Significant associations</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {pairColumns.map((c) => <TableHead key={c} className="capitalize">{c.replace(/_/g, " ")}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.significant_pairs.map((pair, i) => (
                      <TableRow key={i}>
                        {pairColumns.map((c) => {
                          const v = pair[c];
                          return <TableCell key={c} className="tabular-nums">{typeof v === "number" ? v.toFixed(3) : String(v ?? "—")}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {result.warnings.length > 0 && (
            <Card className="border-amber-400/40 bg-amber-50/40 dark:bg-amber-900/10">
              <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
                <ul className="list-disc pl-5 space-y-1">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
