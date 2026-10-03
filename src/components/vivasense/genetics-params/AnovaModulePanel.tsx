import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Play, BarChart3, Download, CheckCircle2, AlertTriangle,
  FileSpreadsheet, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { downloadReport } from "@/lib/geneticsUploadApi";
import {
  analyzeUpload, inferFileType, buildGovernedExportPayload,
  type UploadAnalysisResponse,
} from "@/services/geneticsUploadApi";
import { AcademicResultsPanel } from "./AcademicResultsPanel";
import { pl } from "@/lib/utils";
import { describeResultScale, buildDescriptiveStats } from "./resultCounts";
import { recordAnalysis, recordAnalysisFailure } from "@/services/history/historyService";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { AnovaAlpha } from "@/services/geneticsUploadApi";
import {
  GOVERNED_DESIGNS,
  type GovernedDesignType,
  type ColumnMapping,
  type ColumnRole,
  designMeta,
  requiredRoles,
  validateMapping,
  buildStructuralPreview,
  buildAnovaRequest,
  describeStructuralError,
} from "./anovaDesigns";
import {
  isGovernedOneFactor,
  chooseExportRoute,
  describeExportFailure,
  isStaleTokenFailure,
} from "./governedOneFactor";
import { GovernedOneFactorPanel } from "./GovernedOneFactorPanel";
import { isGovernedFactorial } from "./governedFactorial";
import { GovernedFactorialPanel } from "./GovernedFactorialPanel";
import { isGovernedSplitPlot } from "./governedSplitPlot";
import { GovernedSplitPlotPanel } from "./GovernedSplitPlotPanel";
import { RcbdTransformationPanel } from "./RcbdTransformationPanel";
import { explorationEligibility } from "./governedTransformation";
import { runPersistentRcbdAnalysis, downloadPersistentRcbdReport } from "@/services/persistenceRcbdApi";
import {
  SESSION_ONLY_PREVIEW_WARNING,
  isSessionOnlyPreviewDesign,
  isSessionOnlyPreviewWarning,
} from "./releaseDisclosures";
import {
  defaultDesignForBlockMapping,
  describeResponseExclusion,
  describeTraitFailure,
  readBackendCvPercent,
  resolveReleaseStatus,
  type FailureDisplay,
} from "./feBeta02";

const MODULE = "anova" as const;

/** Inferential alphas the governed backend accepts. Diagnostic α stays 0.05. */
const ALPHA_OPTIONS: AnovaAlpha[] = [0.01, 0.05, 0.1];
const DEFAULT_ALPHA: AnovaAlpha = 0.05;

interface Props {
  datasetContext: DatasetContext | null;
}

export function AnovaModulePanel({ datasetContext }: Props) {
  const { toast } = useToast();
  const [design, setDesign] = useState<GovernedDesignType>("rcbd");
  const [alpha, setAlpha] = useState<AnovaAlpha>(DEFAULT_ALPHA);
  const [structuralError, setStructuralError] = useState<FailureDisplay | null>(null);
  // CardTitle forwards its ref typed as HTMLParagraphElement (it renders an h3).
  const resultsHeadingRef = useRef<HTMLParagraphElement | null>(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Mappings (per-design)
  const [treatmentCol, setTreatmentCol] = useState<string>("");
  const [repColumn, setRepColumn] = useState<string>("");
  const [factorA, setFactorA] = useState<string>("");
  const [factorB, setFactorB] = useState<string>("");
  const [mainPlot, setMainPlot] = useState<string>("");
  const [subPlot, setSubPlot] = useState<string>("");

  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<UploadAnalysisResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  // Assumption-driven transformation: which branch feeds the report. Defaults to
  // "transformed" so a flagged violation is not silently ignored; "raw" keeps the
  // untransformed results (report then prints the caution disclosure).
  const [transformChoice, setTransformChoice] = useState<"transformed" | "raw">("transformed");
  const [showTransformWhy, setShowTransformWhy] = useState(false);

  // A newly uploaded dataset is a new analysis context. Reset every selection
  // that could otherwise leak from the previous file (the live-browser RCBD
  // failure showed a stale response trait and stale mappings crossing files).
  useEffect(() => {
    // A dataset mapped with no Replication / Block is a CRD; keeping a stale
    // RCBD selection there is the "CRD chosen, RCBD analysed" confusion.
    setDesign(defaultDesignForBlockMapping(datasetContext?.repColumn));
    setAlpha(DEFAULT_ALPHA);
    setTreatmentCol(datasetContext?.genotypeColumn ?? "");
    setRepColumn(datasetContext?.repColumn ?? "");
    setFactorA("");
    setFactorB("");
    setMainPlot("");
    setSubPlot("");
    setSelectedTraits([]);
    setResults(null);
    setStructuralError(null);
    setShowErrorDetail(false);
    setExportError(null);
    setAnalysisError(null);
    setTransformChoice("transformed");
    setShowTransformWhy(false);
  }, [datasetContext]);

  // Bring a newly rendered result into view. The results render below a long
  // setup form, so without this a beginner can finish a run and see nothing
  // change. Focus moves to the results heading (keyboard / screen-reader users)
  // and the scroll is instant when the user prefers reduced motion.
  useEffect(() => {
    if (!results) return;
    const heading = resultsHeadingRef.current;
    if (!heading) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  }, [results]);

  // All available columns for selectors — computed safely even when no dataset (returns []).
  const allColumns = useMemo(() => {
    if (!datasetContext) return [];
    const traits = new Set(datasetContext.availableTraitColumns);
    // Broad discovery: use all columns from the dataset pool
    const all = (datasetContext as any).columns ?? (datasetContext as any).availableColumns ?? [];
    if (all.length > 0) {
      return all.filter((c: string) => !traits.has(c));
    }
    // Fallback to detected structural columns
    const candidates = [
      datasetContext.genotypeColumn,
      datasetContext.repColumn,
      datasetContext.environmentColumn,
    ].filter(Boolean) as string[];
    return Array.from(new Set(candidates));
  }, [datasetContext]);

  if (!datasetContext) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium">
              Upload a dataset first to run a domain-neutral ANOVA analysis.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleOptions = (role: ColumnRole): string[] => {
    const activeRoles = requiredRoles(design);
    const claimedElsewhere = new Set(
      activeRoles
        .filter((other) => other !== role)
        .map((other) => mapping[other])
        .filter((value): value is string => !!value),
    );
    return allColumns.filter(
      (column: string) => column === mapping[role] || !claimedElsewhere.has(column),
    );
  };

  const toggleTrait = (t: string) =>
    setSelectedTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  // ── Mapping + validation ───────────────────────────────────────────────
  // Only roles the chosen design actually uses are collected, so a column left
  // over from a previous selection is never sent. That matters most for
  // Factorial CRD: a stray block would reintroduce the synthetic-block model
  // that aliased Factor B away.
  const mapping: ColumnMapping = {
    treatment: treatmentCol,
    rep: repColumn,
    factor_a: factorA,
    factor_b: factorB,
    main_plot: mainPlot,
    sub_plot: subPlot,
  };
  const issue = validateMapping(design, mapping, selectedTraits);
  const validation = issue?.message ?? null;

  const previewRows = (datasetContext.dataPreview ?? []) as Record<string, unknown>[];
  const preview = buildStructuralPreview(
    design,
    mapping,
    alpha,
    previewRows,
    typeof datasetContext.nRows === "number" && previewRows.length === datasetContext.nRows,
  );

  const isSplitPlot = design === "split_plot_rcbd";
  const isFactorialFamily = design === "factorial_crd" || design === "factorial_rcbd";
  const roles = requiredRoles(design);

  // ── Run analysis ──────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (validation) return;
    setIsAnalyzing(true);
    setResults(null);
    setStructuralError(null);
    setAnalysisError(null);
    // Hoisted so the failure path reports the same fields and elapsed time.
    const startedAt = performance.now();
    const historyBase = {
      analysisType: "anova" as const,
      backendEndpoint: design === "rcbd"
        ? "/persistence/analysis-runs/execute"
        : "/genetics/analyze-upload?module=anova",
      datasetName: datasetContext.file.name,
      datasetToken: datasetContext.datasetToken ?? null,
      designType: design,
      traits: selectedTraits,
      startedAt,
      parameters: { design_type: design, alpha, mode: datasetContext.mode },
    };
    try {
      console.log("[MODULE]", MODULE, "[DESIGN]", design, "[ALPHA]", alpha);
      console.log("[handleAnalyze] Running ANOVA with traits:", selectedTraits);

      const request = buildAnovaRequest({
        datasetContext,
        design,
        alpha,
        mapping,
        traits: selectedTraits,
      });

      const res = design === "rcbd"
        ? await runPersistentRcbdAnalysis({
            datasetContext,
            treatmentColumn: treatmentCol,
            repColumn,
            selectedTraits,
            alpha,
          })
        : await analyzeUpload(request);

      // A trait can fail structurally while the HTTP call succeeds — the
      // backend rejects invalid structures before fitting rather than
      // returning a partial model, so surface the reason here.
      // structural_validation.message is authoritative: it names the offending
      // value, row and treatment / block, which the generic code translation
      // cannot. The translation is only the fallback for older payloads.
      const firstFailure = Object.values(res.trait_results ?? {}).find(
        (tr) => tr.status === "failed" && (tr.error || tr.structural_validation?.message)
      );
      let shownFailure: FailureDisplay | null = null;
      if (firstFailure) {
        const failure = describeTraitFailure(firstFailure);
        shownFailure = firstFailure.structural_validation?.message
          ? failure
          : { ...failure, message: describeStructuralError(failure.raw).message };
      }
      setStructuralError(shownFailure);
      const successCount = Object.values(res.trait_results).filter((tr) => tr.status === "success").length;
      if (successCount === 0) {
        // Every response was refused: this is not a completed analysis, so it is
        // neither announced as one nor recorded as a successful run.
        toast({
          title: "Analysis could not be completed",
          description: "No response variable was analysed. See the explanation above the Run button.",
          variant: "destructive",
        });
        void recordAnalysisFailure(
          historyBase,
          new Error(shownFailure?.message ?? firstFailure?.error ?? "No response variable was analysed."),
        );
        return;
      }
      setResults(res);
      toast({ title: "ANOVA complete", description: `${pl(successCount, "response variable")} analyzed.` });

      // Persist to Research Analysis History (best-effort; never blocks the flow).
      void recordAnalysis({
        ...historyBase,
        response: res,
        parameters: {
          ...historyBase.parameters,
          // Recorded so history can show maturity and withhold Open/Reopen and
          // "publication-ready" credit from Preview analyses.
          ...(res.release_status ? { release_status: res.release_status } : {}),
          ...(res.persistence
            ? {
                persistence_analysis_run_id: res.persistence.analysis_run_id,
                persistence_dataset_version_id: res.persistence.dataset_version_id,
                persistence_study_id: res.persistence.study_id,
                persistence_outcome: res.persistence.run_outcome,
              }
            : {}),
        },
      });
    } catch (err: any) {
      void recordAnalysisFailure(historyBase, err);
      const message = err instanceof Error ? err.message : String(err ?? "Analysis failed.");
      setAnalysisError(message);
      toast({ title: "ANOVA failed", description: message, variant: "destructive" });
      sonnerToast.error("ANOVA failed", { description: message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Download report ───────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!results) return;
    setExportError(null);
    setIsDownloading(true);
    try {
      if (results.persistence) {
        await downloadPersistentRcbdReport(
          results.persistence.analysis_run_id,
          `VivaSense_ANOVA_rcbd_${new Date().toISOString().slice(0, 10)}.docx`,
        );
        sonnerToast.success("Persistent ANOVA report downloaded");
        return;
      }

      // Governed route: send the FULL analysis response and echo the exact
      // export_token the backend issued. The hand-assembled payload below
      // cannot carry governed content — it drops the decision objects, the
      // profiles, the separation statuses and the token itself — so it is now
      // reserved for legacy results that never had a token.
      if (chooseExportRoute(results) === "governed") {
        const governed = buildGovernedExportPayload(results, { module: MODULE });
        const blob = await downloadReport(MODULE, governed);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VivaSense_ANOVA_${design}_${new Date().toISOString().slice(0, 10)}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        sonnerToast.success("ANOVA report downloaded");
        return;
      }

      const payload = {
        analysis_type: MODULE,
        design_type: design,
        dataset_summary: results.dataset_summary,
        summary_table: results.summary_table,
        trait_results: Object.fromEntries(
          Object.entries(results.trait_results)
            .filter(([, tr]) => tr.status === "success" && tr.analysis_result)
            .map(([trait, tr]) => {
              const ar = tr.analysis_result;
              const result = ar?.result;
              return [trait, {
                anova_table: result?.anova_table,
                mean_separation: isSplitPlot ? undefined : result?.mean_separation,
                grand_mean: result?.grand_mean,
                n_genotypes: result?.n_genotypes,
                n_reps: result?.n_reps,
                interpretation: ar?.interpretation || "",
              }];
            })
        ),
        failed_traits: results.failed_traits,
        transformation_choice: transformChoice,
      };

      const blob = await downloadReport(MODULE, payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VivaSense_ANOVA_${design}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      sonnerToast.success("ANOVA report downloaded");
    } catch (err) {
      // An exact-token refusal (409) is not a transient failure and must not be
      // retried against some other cached analysis — the correct action is to
      // rerun, so say exactly that instead of a generic "Download failed".
      const message = err instanceof Error ? err.message : String(err);
      // The shared client throws the backend's `detail` text, not a status
      // code, so a 409 usually arrives as prose — both signals are checked.
      const match = /\b(409|403)\b/.exec(message);
      const status = match ? Number(match[1]) : null;
      const stale = isStaleTokenFailure(status, message);
      setExportError(describeExportFailure(status, message));
      sonnerToast.error(stale ? "Analysis identity no longer available" : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Field selector helper ─────────────────────────────────────────────
  const ColumnSelect = ({
    label, value, onChange, placeholder = "Select column…", options = allColumns,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    options?: string[];
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Dataset banner */}
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-center gap-2 text-sm">
        <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
        <span>Using: <span className="font-medium">{datasetContext.file.name}</span></span>
        <Badge variant="outline" className="ml-auto text-xs">
          {pl(datasetContext.availableTraitColumns.length, "response variable")} · {datasetContext.mode} mode
        </Badge>
      </div>

      {/* Design selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Choose Experimental Design
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Select the design that matches the experiment and then map the relevant treatment, replication, factor, and response columns.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={design} onValueChange={(v) => setDesign(v as GovernedDesignType)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
              {GOVERNED_DESIGNS.map((d) => (
                <TabsTrigger key={d.id} value={d.id} className="text-xs sm:text-sm">{d.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="rounded-md border bg-muted/30 p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <Badge
                variant={isSessionOnlyPreviewDesign(design) ? "outline" : "secondary"}
                className={
                  isSessionOnlyPreviewDesign(design)
                    ? "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }
              >
                {/* Before a run there is no payload yet, so the design decides;
                    after a run the backend release_status takes over (see Results). */}
                {resolveReleaseStatus(null, design).label}
              </Badge>
              <p>{designMeta(design).hint}</p>
              {isSessionOnlyPreviewDesign(design) && (
                <p className="text-amber-800 dark:text-amber-300">
                  Download the Word report before leaving this session.
                </p>
              )}
            </div>
          </div>

          {/* Field mapping — driven by the design's required roles */}
          <div className="grid gap-4 sm:grid-cols-2">
            {roles.includes("treatment") && (
              <ColumnSelect label="Treatment / Factor Column" value={treatmentCol} onChange={setTreatmentCol} options={roleOptions("treatment")} />
            )}
            {roles.includes("factor_a") && (
              <ColumnSelect label="Factor A Column" value={factorA} onChange={setFactorA} options={roleOptions("factor_a")} />
            )}
            {roles.includes("factor_b") && (
              <ColumnSelect label="Factor B Column" value={factorB} onChange={setFactorB} options={roleOptions("factor_b")} />
            )}
            {roles.includes("main_plot") && (
              <ColumnSelect label="Whole-Plot Factor Column" value={mainPlot} onChange={setMainPlot} options={roleOptions("main_plot")} />
            )}
            {roles.includes("sub_plot") && (
              <ColumnSelect label="Subplot Factor Column" value={subPlot} onChange={setSubPlot} options={roleOptions("sub_plot")} />
            )}
            {roles.includes("rep") && (
              <ColumnSelect label="Replication / Block Column" value={repColumn} onChange={setRepColumn} options={roleOptions("rep")} />
            )}
            {isFactorialFamily && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {design === "factorial_crd"
                  ? "Completely randomised: the model estimates Factor A, Factor B, their interaction and the error term. No blocking term is fitted."
                  : "Blocked: the model estimates the block, Factor A, Factor B, their interaction and the error term."}
              </p>
            )}
          </div>

          {/* Inferential alpha */}
          <div className="rounded-md border p-3 space-y-2">
            <Label className="text-sm font-medium">Significance level (inferential α)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {ALPHA_OPTIONS.map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant={alpha === a ? "default" : "outline"}
                  onClick={() => setAlpha(a)}
                  aria-pressed={alpha === a}
                >
                  α = {a.toFixed(2)}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This is the <span className="font-medium">inferential</span> significance level: it decides
              which effects are called significant, whether mean separation runs, and the wording of the
              report. Assumption diagnostics are always evaluated at a fixed α = 0.05 and are not affected
              by this choice.
            </p>
          </div>

          {/* Structural preview — descriptive only */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Design summary
            </p>
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {preview.rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-3 border-b border-dashed py-0.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Describes the structure implied by your mapping. When only a sample of rows is shown, level counts
              are labelled as lower bounds rather than full-dataset facts. Balance and completeness are checked
              by the analysis engine against the full dataset.
            </p>
          </div>

          {isSplitPlot && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Split-Plot RCBD</p>
              <p>The whole-plot factor is tested against whole-plot error (Error A). The subplot factor and the interaction are tested against subplot error (Error B).</p>
            </div>
          )}

          {/* Response variable selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Response Variable(s)</Label>
            <div className="flex flex-wrap gap-3">
              {datasetContext.availableTraitColumns.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedTraits.includes(t)} onCheckedChange={() => toggleTrait(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* The slot is always mounted at a fixed height so that choosing a
              response variable (which clears this message) does not shift the
              controls below it — a moving Run button caused missed clicks. */}
          <div className="min-h-[2.75rem]" aria-live="polite">
            {validation && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {validation}
              </div>
            )}
          </div>

          {structuralError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-2"
            >
              <p className="font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {structuralError.heading}
              </p>
              <p className="text-foreground">{structuralError.message}</p>
              <p className="text-muted-foreground">
                The analysis was stopped before any model was fitted, so no partial result was produced.
              </p>
              <button
                type="button"
                className="underline text-muted-foreground"
                onClick={() => setShowErrorDetail((v) => !v)}
              >
                {showErrorDetail ? "Hide technical detail" : "Show technical detail"}
              </button>
              {showErrorDetail && (
                <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px] text-muted-foreground">
                  {structuralError.code ? `[${structuralError.code}]\n` : ""}
                  {structuralError.raw}
                </pre>
              )}
            </div>
          )}

          {analysisError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1.5"
            >
              <p className="font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Analysis failed
              </p>
              <p className="text-foreground whitespace-pre-wrap break-words">{analysisError}</p>
              <p className="text-muted-foreground">
                Check the selected dataset, response variable, and design mappings, then run the analysis again.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !!validation}
              aria-busy={isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isAnalyzing ? "Running analysis…" : "Run Analysis"}
            </Button>
            {/* No percentage is shown: the engine reports no real progress. */}
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground min-h-[1rem]">
              {isAnalyzing ? "Running analysis… please keep this page open until the results appear." : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle
                ref={resultsHeadingRef}
                tabIndex={-1}
                className="text-lg flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ANOVA Results — {designMeta(design).fullLabel}
              </CardTitle>
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                size="sm"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                title={results.persistence ? "Download report from the immutable AnalysisResult." : undefined}
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isDownloading
                  ? "Downloading..."
                  : results.persistence
                    ? "Download Persistent ANOVA Report"
                    : "Download ANOVA Report"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-sm">
                {!isFactorialFamily && !isSplitPlot && (results.dataset_summary.n_genotypes ?? 0) > 0 && (
                  <Badge variant="secondary">{pl(results.dataset_summary.n_genotypes, "treatment level")}</Badge>
                )}
                {(results.dataset_summary.n_reps ?? 0) > 0 && (
                  <Badge variant="secondary">{pl(results.dataset_summary.n_reps, "replication")}</Badge>
                )}
                <Badge variant="outline">{results.dataset_summary.mode} mode</Badge>
                {results.persistence && (
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                    durable run · {results.persistence.run_outcome}
                  </Badge>
                )}
              </div>
              {results.persistence && (
                <p className="mt-2 text-xs text-muted-foreground">
                  AnalysisRun {results.persistence.analysis_run_id} · DatasetVersion {results.persistence.dataset_version_id}
                </p>
              )}
            </CardContent>
          </Card>

          {(() => {
            // Maturity comes from the backend `release_status`; the design is
            // only the fallback for payloads that predate it.
            const release = resolveReleaseStatus(results.release_status, design);
            if (release.maturity === "preview") {
              return (
                <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
                  <CardContent className="py-4 px-5 space-y-1">
                    <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4" /> {release.label}
                    </p>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
                      {release.disclosure ??
                        (() => {
                          const message = SESSION_ONLY_PREVIEW_WARNING.replace("Preview: ", "");
                          return message.charAt(0).toUpperCase() + message.slice(1);
                        })()}
                    </p>
                  </CardContent>
                </Card>
              );
            }
            if (release.maturity === "early_access") {
              return (
                <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs space-y-1">
                  <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300">
                    {release.label}
                  </Badge>
                  {release.disclosure && <p className="text-muted-foreground">{release.disclosure}</p>}
                </div>
              );
            }
            return null;
          })()}

          {(() => {
            type TA = {
              triggered?: boolean; recommended_transform?: string; formula_used?: string;
              rationale?: string; disclosure_text?: string;
            };
            // LEGACY ONLY. The governed RCBD path uses exploration -> explicit
            // selection -> selected export; this raw/transformed report toggle is
            // a competing mechanism and must not coexist with it. It survives
            // solely for stored responses that predate the governed contract.
            if (chooseExportRoute(results) === "governed" && design === "rcbd") return null;
            const triggered = Object.entries(results.trait_results)
              .map(([trait, tr]) => ({
                trait,
                ta: (tr.analysis_result?.result as { transformation_analysis?: TA } | undefined)
                  ?.transformation_analysis,
              }))
              .filter((x): x is { trait: string; ta: TA } => !!x.ta && !!x.ta.triggered);
            if (triggered.length === 0) return null;
            const first = triggered[0].ta;
            const tName = String(first.recommended_transform ?? "").replace(/_/g, " ");
            return (
              <Card className="border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20">
                <CardContent className="py-4 px-5 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-blue-900 dark:text-blue-200">
                        Your data may benefit from a {tName} transformation
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Residual assumptions were violated for{" "}
                        {triggered.length === 1 ? triggered[0].trait : `${triggered.length} response variables`}.
                        {" "}A {tName} transform ({first.formula_used}) restored them.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={transformChoice === "transformed" ? "default" : "outline"}
                      onClick={() => setTransformChoice("transformed")}>
                      Use transformed results
                    </Button>
                    <Button size="sm" variant={transformChoice === "raw" ? "default" : "outline"}
                      onClick={() => setTransformChoice("raw")}>
                      Keep raw results
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowTransformWhy((v) => !v)}>
                      {showTransformWhy ? "Hide details" : "Why?"}
                    </Button>
                  </div>
                  {showTransformWhy && (
                    <div className="text-xs text-blue-900/90 dark:text-blue-200/90 space-y-2 border-t border-blue-200 dark:border-blue-800 pt-2">
                      {triggered.map(({ trait, ta }) => (
                        <div key={trait}>
                          <span className="font-medium">{trait}:</span> {ta.rationale} {ta.disclosure_text}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-blue-700/80 dark:text-blue-300/70">
                    The report will use the{" "}
                    <span className="font-medium">
                      {transformChoice === "transformed" ? "transformed" : "raw (untransformed)"}
                    </span>{" "}
                    results.{" "}
                    {transformChoice === "raw"
                      ? "A caution note will be included because assumptions were flagged."
                      : "Raw results remain available."}
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {isSplitPlot && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
              <CardContent className="py-4 px-5 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-semibold mb-1">Error strata</p>
                <p>Main-plot effects are evaluated using whole-plot variability. Subplot effects and interactions are evaluated using subplot variability.</p>
              </CardContent>
            </Card>
          )}

          {exportError && (
            <Card className="border-destructive/40" role="alert">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                  <AlertTriangle className="h-4 w-4" /> Report not generated
                </div>
                <p className="text-xs text-foreground">{exportError}</p>
              </CardContent>
            </Card>
          )}

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

            // Governed CRD/RCBD presentation renders only when the backend
            // actually sent the decision objects. A legacy result without them
            // keeps the existing panel and is never relabelled "governed".
            const governed = isGovernedOneFactor(r, design);
            const governedFactorial = isGovernedFactorial(r, design);
            const governedSplitPlot = isGovernedSplitPlot(r, design);
            // CRD only: blank response cells are excluded (not outliers). Structural
            // designs refuse incomplete data instead and never carry this object.
            const exclusion = design === "crd" ? describeResponseExclusion(r.response_exclusion) : null;

            return (
              <div key={trait} className="space-y-3">
                <h3 className="text-base font-semibold text-foreground px-1">{trait}</h3>
                {exclusion && (
                  <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800">
                    <CardContent className="py-4 px-5 space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                        <Info className="h-4 w-4" /> Blank response cells were excluded
                      </p>
                      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        {exclusion.lines.map((line) => (
                          <div key={line.label} className="flex justify-between gap-3 border-b border-dashed border-amber-300/60 py-0.5">
                            <dt className="text-amber-900/80 dark:text-amber-200/80">{line.label}</dt>
                            <dd className="font-medium text-right">{line.value}</dd>
                          </div>
                        ))}
                      </dl>
                      {exclusion.unequalReplicationNote && (
                        <p className="text-xs text-amber-900 dark:text-amber-200">{exclusion.unequalReplicationNote}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
                {governed && (
                  <GovernedOneFactorPanel
                    design={design}
                    result={r}
                    mapping={{ treatment: treatmentCol, rep: repColumn }}
                    inferentialAlpha={alpha}
                  />
                )}
                {governedFactorial && (
                  <GovernedFactorialPanel
                    design={design}
                    result={r}
                    mapping={{ rep: repColumn }}
                    inferentialAlpha={alpha}
                  />
                )}
                {isGovernedOneFactor(r, design) &&
                  explorationEligibility(design, r, tr.status, results.export_token).available && (
                    <RcbdTransformationPanel
                      trait={trait}
                      rawAnalysisToken={results.export_token as string}
                      alpha={alpha}
                      rawResult={r}
                    />
                  )}
                {governedSplitPlot && (
                  <GovernedSplitPlotPanel
                    result={r}
                    mapping={{ rep: repColumn, mainPlot: mainPlot, subPlot: subPlot }}
                    inferentialAlpha={alpha}
                  />
                )}
                <AcademicResultsPanel
                  moduleLabel="ANOVA"
                  domainNeutral
                  insightSummary={governedFactorial || governedSplitPlot ? undefined : describeResultScale(r)}
                  interpretation={tr.analysis_result.interpretation || ""}
                  statisticalNotes={(() => {
                    const warnings = (tr.data_warnings ?? []).filter(
                      (w) =>
                        !isSessionOnlyPreviewWarning(w) &&
                        // The exclusion card above already states this; do not repeat it.
                        !(exclusion && w === r.response_exclusion?.message)
                    );
                    return warnings.length > 0
                      ? warnings.map((w) => ({ text: w }))
                      : undefined;
                  })()}
                  inferentialAlpha={alpha}
                  anovaTable={r.anova_table}
                  cvPercent={readBackendCvPercent(r)}
                  meanSeparation={isSplitPlot || governedFactorial ? undefined : r.mean_separation}
                  descriptiveStats={governedFactorial || governedSplitPlot ? undefined : buildDescriptiveStats(r)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
