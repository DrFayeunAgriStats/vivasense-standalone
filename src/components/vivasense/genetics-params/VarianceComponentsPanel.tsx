/**
 * Variance Components & Heritability — single-environment genetics analysis.
 *
 * A separate analysis type, not an ANOVA design variant: it estimates σ²g, σ²e,
 * σ²p, H², GCV, PCV, GA and GAM for one or more traits from a CRD or RCBD trial
 * in a single environment.
 *
 * Governing rule for this panel: when the researcher explicitly asks for
 * variance components, the run either returns the genetics result or fails with
 * a stated reason. A "success" response carrying empty variance_components /
 * heritability is surfaced as an error, never as a clean-looking empty table —
 * descriptive statistics is a different analysis, not a fallback.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Play, Dna, CheckCircle2, AlertTriangle, FileSpreadsheet, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { computeVarianceComponents, registerDataset } from "@/lib/geneticsUploadApi";
import { pl } from "@/lib/utils";
import { recordAnalysis, recordAnalysisFailure } from "@/services/history/historyService";
import type {
  DatasetContext,
  GeneticParametersResponse,
  GeneticParametersTraitResult,
} from "@/types/geneticsUpload";

type VcDesign = "crd" | "rcbd";

interface Props {
  datasetContext: DatasetContext | null;
}

const DESIGNS: { id: VcDesign; label: string; hint: string }[] = [
  {
    id: "rcbd",
    label: "RCBD",
    hint: "Randomized Complete Block Design — genotypes replicated across blocks. Replication column required.",
  },
  {
    id: "crd",
    label: "CRD",
    hint: "Completely Randomized Design — no blocking. Replication is inferred from repeated observations per genotype.",
  },
];

/** 4-dp for variances and means; "—" when the backend could not estimate it. */
function num(v: unknown, digits = 4): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toFixed(digits);
}

/**
 * A trait result is only usable when the genetics slice actually came back.
 * `status: "success"` alone is not enough — an incomplete run can still return
 * success with both dictionaries empty.
 */
function geneticsSliceMissing(tr: GeneticParametersTraitResult): boolean {
  const vc = tr.variance_components;
  const h2 = tr.heritability;
  const vcEmpty = !vc || Object.keys(vc).length === 0;
  const h2Empty = !h2 || Object.keys(h2).length === 0;
  return vcEmpty || h2Empty;
}

export function VarianceComponentsPanel({ datasetContext }: Props) {
  const { toast } = useToast();

  const [design, setDesign] = useState<VcDesign>("rcbd");
  const [genotypeCol, setGenotypeCol] = useState<string>(datasetContext?.genotypeColumn ?? "");
  const [repCol, setRepCol] = useState<string>(datasetContext?.repColumn ?? "");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<GeneticParametersResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Structural (non-trait) columns. Environment, Location and Year are not
  // offered: this analysis is single-environment by definition.
  const allColumns = useMemo(() => {
    if (!datasetContext) return [] as string[];
    const traits = new Set(datasetContext.availableTraitColumns);
    const all = datasetContext.columns ?? datasetContext.availableColumns ?? [];
    if (all.length > 0) return all.filter((c) => !traits.has(c));
    return Array.from(
      new Set([datasetContext.genotypeColumn, datasetContext.repColumn].filter(Boolean) as string[])
    );
  }, [datasetContext]);

  if (!datasetContext) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-3">
          <Dna className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">
            Upload a dataset first to estimate variance components and heritability.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleTrait = (t: string) =>
    setSelectedTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const validation = (() => {
    if (!genotypeCol) return "Select the Genotype / Entry column.";
    if (design === "rcbd") {
      if (!repCol) return "Select a Replication / Block column (required for RCBD).";
      if (repCol === genotypeCol) return "Genotype and Replication must be different columns.";
    }
    if (selectedTraits.length === 0) return "Select at least one trait.";
    return null;
  })();

  const effectiveRep = design === "rcbd" ? repCol : null;

  const handleAnalyze = async () => {
    if (validation) return;
    setIsAnalyzing(true);
    setResults(null);
    setRunError(null);

    const startedAt = performance.now();
    const historyBase = {
      analysisType: "genetic_parameters" as const,
      backendEndpoint: "/analysis/genetic-parameters",
      datasetName: datasetContext.file.name,
      datasetToken: datasetContext.datasetToken ?? null,
      designType: design,
      traits: selectedTraits,
      startedAt,
      parameters: {
        genotype_column: genotypeCol,
        rep_column: effectiveRep,
        design_type: design,
        mode: "single",
      },
    };

    try {
      // Step 1 — register the declared mapping. /analysis/genetic-parameters
      // resolves the genotype and replication roles from the token's cached
      // context, so the token issued at preview time (built from auto-detected
      // columns) would analyse a column the researcher did not choose. This is
      // the explicit declaration that replaced the name-keyword heuristic; it
      // has to reach the backend as a registration, not just as request fields.
      const registered = await registerDataset({
        base64_content: datasetContext.base64Content,
        file_type: datasetContext.fileType,
        genotype_column: genotypeCol,
        rep_column: effectiveRep,
        environment_column: null,
        design_type: design,
        mode: "single",
        random_environment: false,
        selection_intensity: 0.2,
      });

      const res = await computeVarianceComponents({
        dataset_token: registered.dataset_token,
        genotype_column: genotypeCol,
        rep_column: effectiveRep,
        design_type: design,
        trait_columns: selectedTraits,
        mode: "single",
      });

      setResults(res);

      const usable = Object.values(res.trait_results).filter(
        (tr) => tr.status === "success" && !geneticsSliceMissing(tr)
      ).length;

      if (usable === 0) {
        toast({
          title: "No genetic parameters returned",
          description: "The analysis did not complete for any selected trait.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Variance components complete",
          description: `${pl(usable, "trait")} analyzed.`,
        });
      }

      void recordAnalysis({
        ...historyBase,
        datasetToken: registered.dataset_token,
        response: res,
      });
    } catch (err: any) {
      const message = err?.message || "Variance components analysis failed";
      setRunError(message);
      void recordAnalysisFailure(historyBase, err);
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dataset banner */}
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-center gap-2 text-sm">
        <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
        <span>Using: <span className="font-medium">{datasetContext.file.name}</span></span>
        <Badge variant="outline" className="ml-auto text-xs">
          {pl(datasetContext.availableTraitColumns.length, "trait")} · single environment
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Dna className="h-5 w-5 text-primary" />
            Variance Components &amp; Heritability
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            σ²g, H², GCV, PCV and genetic advance for a single-environment trial.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Design — CRD or RCBD only. Factorial, split-plot and multi-environment
              models cannot yield a single pooled error term for σ²g. */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Design</Label>
            <div className="flex flex-wrap gap-2">
              {DESIGNS.map((d) => (
                <Button
                  key={d.id}
                  type="button"
                  size="sm"
                  variant={design === d.id ? "default" : "outline"}
                  onClick={() => setDesign(d.id)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 flex gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{DESIGNS.find((d) => d.id === design)?.hint}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Genotype / Entry Column</Label>
              <Select value={genotypeCol || undefined} onValueChange={setGenotypeCol}>
                <SelectTrigger><SelectValue placeholder="Select column…" /></SelectTrigger>
                <SelectContent>
                  {allColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The column identifying the entries being compared — whatever it is named.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Replication / Block Column {design === "crd" && (
                  <span className="font-normal text-muted-foreground">(not used for CRD)</span>
                )}
              </Label>
              <Select
                value={repCol || undefined}
                onValueChange={setRepCol}
                disabled={design === "crd"}
              >
                <SelectTrigger><SelectValue placeholder={design === "crd" ? "Not required" : "Select column…"} /></SelectTrigger>
                <SelectContent>
                  {allColumns.filter((c) => c !== genotypeCol).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Traits */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Trait(s)</Label>
            <div className="flex flex-wrap gap-3">
              {datasetContext.availableTraitColumns.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedTraits.includes(t)} onCheckedChange={() => toggleTrait(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {validation && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> {validation}
            </div>
          )}

          <Button onClick={handleAnalyze} disabled={isAnalyzing || !!validation} className="gap-2">
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Analysis
          </Button>
        </CardContent>
      </Card>

      {runError && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> Analysis did not complete
            </div>
            <p className="text-sm text-muted-foreground">{runError}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Variance Components &amp; Heritability — {DESIGNS.find((d) => d.id === design)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{genotypeCol} as genotype</Badge>
                {effectiveRep && <Badge variant="secondary">{effectiveRep} as replication</Badge>}
                <Badge variant="outline">single environment</Badge>
              </div>
            </CardContent>
          </Card>

          {selectedTraits.map((trait) => {
            const tr = results.trait_results[trait];

            if (!tr) {
              return (
                <Card key={trait} className="border-destructive/40">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {trait} — no result returned
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The backend returned no entry for this trait. Nothing is shown rather than an
                      empty table.
                    </p>
                  </CardContent>
                </Card>
              );
            }

            // Failure, or "success" with an empty genetics slice — both are
            // reported as an incomplete analysis with the backend's own reason.
            if (tr.status !== "success" || geneticsSliceMissing(tr)) {
              return (
                <Card key={trait} className="border-destructive/40">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {trait} — analysis did not complete
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tr.error ||
                        "Variance components and heritability were not estimated for this trait, " +
                        "so no genetic parameters can be reported. Check that the genotype column " +
                        "has at least 2 levels and that replication is present for RCBD."}
                    </p>
                  </CardContent>
                </Card>
              );
            }

            const vc = tr.variance_components ?? {};
            const her = tr.heritability ?? {};
            const h2Raw = her.h2_broad_sense;
            const h2 = typeof h2Raw === "number" ? h2Raw : Number(h2Raw);
            const h2Known = Number.isFinite(h2);

            const rows: { label: string; value: string }[] = [
              { label: "Grand Mean", value: num(tr.grand_mean) },
              { label: "σ²g (Genotypic Variance)", value: num(vc.sigma2_genotype) },
              { label: "σ²e (Error Variance)", value: num(vc.sigma2_error) },
              { label: "σ²p (Phenotypic Variance)", value: num(vc.sigma2_phenotypic) },
              { label: "H² (Broad-sense Heritability)", value: num(h2Raw) },
              { label: "GCV% (Genotypic CV)", value: num(tr.gcv, 2) },
              { label: "PCV% (Phenotypic CV)", value: num(tr.pcv, 2) },
              { label: "GA (Genetic Advance)", value: num(tr.ga) },
              { label: "GAM% (GA as % of Mean)", value: num(tr.gam, 2) },
            ];

            return (
              <Card key={trait}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{trait}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">Parameter</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.label}>
                            <TableCell className="font-medium">{r.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {h2Known && h2 >= 0.6 && (
                    <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                      High heritability (H² = {h2.toFixed(2)}) — most of the observed variation is
                      genotypic, so selection on this trait is expected to be effective.
                    </div>
                  )}
                  {h2Known && h2 < 0.3 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
                      Low heritability (H² = {h2.toFixed(2)}) — environmental variance dominates, so
                      selection on individual phenotypes is unreliable for this trait.
                    </div>
                  )}

                  {tr.breeding_implication && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-1">Breeding implication</p>
                      <p className="text-muted-foreground">{tr.breeding_implication}</p>
                    </div>
                  )}

                  {tr.interpretation && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-1">Interpretation</p>
                      <p className="text-muted-foreground whitespace-pre-line">{tr.interpretation}</p>
                    </div>
                  )}

                  {tr.data_warnings && tr.data_warnings.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                      {tr.data_warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
