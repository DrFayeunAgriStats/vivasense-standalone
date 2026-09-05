import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  RESPONSE_SEMANTIC_OPTIONS,
  type ResponseSemantic,
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
  designMeta,
  requiredRoles,
  validateMapping,
  buildStructuralPreview,
  buildAnovaRequest,
  describeStructuralError,
  ROLE_LABELS,
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
import {
  createAnalysisIdentityController,
  snapshotAnalysisContext,
  type AnalysisResult,
  type ScientificInputs,
} from "./analysisIdentity";
import { canonicalRoleConfirmationFingerprint } from "./roleConfirmationFingerprint";

const MODULE = "anova" as const;

/** Inferential alphas the governed backend accepts. Diagnostic α stays 0.05. */
const ALPHA_OPTIONS: AnovaAlpha[] = [0.01, 0.05, 0.1];

/**
 * W1-UI-02 — post-run disclosure for the states in which no transformation
 * could be recommended.
 *
 * `triggered === false` does not mean "nothing scientifically relevant
 * happened". The transformation banner below is gated on `triggered`, so a
 * trait whose residual diagnostics failed but whose scale was never declared
 * produced no post-run signal at all — and for complete one-factor RCBD the
 * Word report suppressed it too, leaving the finding only in the payload.
 * `recommendation_state` is the authoritative field, so this reads that.
 *
 * Deliberately compact: the boilerplate is stated once and each affected trait
 * contributes a single line with its own diagnostics. Four selected traits with
 * two unrecommendable states produce two lines, not two warning panels.
 * Unaffected traits contribute nothing.
 */
export const UNRECOMMENDABLE_STATES = [
  "scale_unknown",
  "unsupported_scale",
  "declared_scale_mismatch",
] as const;

export type UnrecommendableState = (typeof UNRECOMMENDABLE_STATES)[number];

/** Why no recommendation was made — the scientific meaning, stated plainly. */
export function describeUnrecommendableState(state: UnrecommendableState): string {
  switch (state) {
    case "scale_unknown":
      return "diagnostics indicate possible assumption concerns, and the response scale was not specified — no automatic transformation was recommended.";
    case "unsupported_scale":
      return "the response scale is known, but this workflow has no governed automatic transformation for it — no substitute was chosen.";
    case "declared_scale_mismatch":
      return "the declared response scale conflicts with the observed data, so no scale-dependent transformation was applied — the declared type was not rewritten.";
  }
}

export interface UnrecommendableTrait {
  trait: string;
  state: UnrecommendableState;
  shapiroP?: number | null;
  leveneP?: number | null;
}

export function UnrecommendableStateNotice({ items }: { items: UnrecommendableTrait[] }) {
  if (items.length === 0) return null;
  const p = (v?: number | null) =>
    typeof v === "number" && Number.isFinite(v) ? (v < 0.001 ? "<0.001" : v.toFixed(3)) : "—";
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-1.5" data-testid="unrecommendable-states">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" /> No transformation was recommended
      </p>
      <ul className="space-y-1">
        {items.map(({ trait, state, shapiroP, leveneP }) => (
          <li key={trait} className="text-xs text-muted-foreground" data-testid={`unrecommendable-${trait}`}>
            <span className="font-medium text-foreground">{trait}</span> — {describeUnrecommendableState(state)}
            {" "}
            <span className="whitespace-nowrap">
              (Shapiro-Wilk p = {p(shapiroP)} · Levene p = {p(leveneP)})
            </span>
          </li>
        ))}
      </ul>
      {/* W1-UI-03: this footer is shared across every trait in the list, and
          those traits can carry different recommendation_state values with
          different underlying diagnostic outcomes -- UnrecommendableTrait has
          no assumptions_met field, by design, because no single boolean
          represents a mixed container. The wording below must therefore hold
          regardless of whether any trait's diagnostics passed, failed, or a
          mix of both is present; it makes no diagnostic-outcome claim at all,
          so it cannot go stale the way the previous wording did once
          declared_scale_mismatch became reachable with clean diagnostics. */}
      <p className="text-[11px] text-muted-foreground">
        These notices do not by themselves mean that a transformation is required. The untransformed
        analysis reported here remains the result of record.
      </p>
    </div>
  );
}

/**
 * One trait's declared response scale (W1-INT-04A).
 *
 * Declared at MODULE scope on purpose. A component declared inside another
 * component's body is a new component type on every render, so React unmounts
 * and remounts its subtree and any in-progress interaction is destroyed — the
 * behaviour under investigation in W1-UI-01. This selector must not repeat it.
 * (The existing ColumnSelect is left exactly as it is; it belongs to W1-UI-01.)
 *
 * The Unknown cue is one muted line inside the row, not a warning panel: with
 * several traits selected, repeated alert blocks would drown the form. It
 * states the consequence and nothing more — it does not say a transformation is
 * needed, and it never guesses a scale from the trait name or its values.
 */
export function ResponseScaleRow({
  trait, value, onChange, disabled = false,
}: {
  trait: string;
  value: ResponseSemantic;
  onChange: (value: ResponseSemantic) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium truncate flex-1" title={trait}>{trait}</span>
        <Select value={value} onValueChange={(v) => onChange(v as ResponseSemantic)} disabled={disabled}>
          <SelectTrigger className="h-8 w-[190px] text-xs" aria-label={`Response scale for ${trait}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESPONSE_SEMANTIC_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value === "unknown" && (
        <p className="text-[11px] leading-tight text-muted-foreground">
          Response scale not specified — VivaSense will report diagnostics but will not recommend an
          automatic transformation.
        </p>
      )}
    </div>
  );
}
const DEFAULT_ALPHA: AnovaAlpha = 0.05;

/**
 * W1-INT-06 — renders a completed analysis exclusively from the immutable
 * context bound to it. Deliberately receives no live design/mapping/alpha
 * from its parent at all: there is no prop through which the form above
 * could leak into what gets displayed here, so a result can never be
 * mislabelled by a scientific input the researcher has since changed. This
 * is the fix for the reproduced defect where an RCBD result rendered under
 * "Completely Randomized Design (CRD)" / "CRD has no blocking term" purely
 * because the live design tab had changed while the request was in flight —
 * the backend's own computation (a real, significant block effect) never
 * changed; only the label around it did.
 */
export function AnalysisResultsSection({
  analysisResult,
  transformChoice,
  onTransformChoiceChange,
  showTransformWhy,
  onToggleTransformWhy,
  exportError,
  isDownloading,
  onDownload,
}: {
  analysisResult: AnalysisResult<UploadAnalysisResponse>;
  transformChoice: "transformed" | "raw";
  onTransformChoiceChange: (choice: "transformed" | "raw") => void;
  showTransformWhy: boolean;
  onToggleTransformWhy: () => void;
  exportError: string | null;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  const { response, context } = analysisResult;
  const design = context.design;
  const alpha = context.alpha;
  const isSplitPlot = design === "split_plot_rcbd";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ANOVA Results — {designMeta(design).fullLabel}
          </CardTitle>
          <Button onClick={onDownload} disabled={isDownloading} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? "Downloading..." : "Download ANOVA Report"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{pl(response.dataset_summary.n_genotypes ?? 0, "treatment level")}</Badge>
            <Badge variant="secondary">{pl(response.dataset_summary.n_reps ?? 0, "replication")}</Badge>
            <Badge variant="outline">{response.dataset_summary.mode} mode</Badge>
          </div>
        </CardContent>
      </Card>

      {/* W1-UI-02 — states where nothing could be recommended. Governed by
          recommendation_state, not by `triggered`, and rendered for every
          design including complete one-factor RCBD. */}
      {(() => {
        type TAState = {
          recommendation_state?: string;
          raw_diagnostics?: { shapiro?: { p_value?: number }; levene?: { p_value?: number } };
        };
        const items = Object.entries(response.trait_results)
          .map(([trait, tr]): UnrecommendableTrait | null => {
            const ta = (tr.analysis_result?.result as { transformation_analysis?: TAState } | undefined)
              ?.transformation_analysis;
            const state = ta?.recommendation_state;
            if (!state || !(UNRECOMMENDABLE_STATES as readonly string[]).includes(state)) return null;
            return {
              trait,
              state: state as UnrecommendableState,
              shapiroP: ta?.raw_diagnostics?.shapiro?.p_value ?? null,
              leveneP: ta?.raw_diagnostics?.levene?.p_value ?? null,
            };
          })
          .filter((x): x is UnrecommendableTrait => x !== null);
        return <UnrecommendableStateNotice items={items} />;
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
        if (chooseExportRoute(response) === "governed" && design === "rcbd") return null;
        const triggered = Object.entries(response.trait_results)
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
                  onClick={() => onTransformChoiceChange("transformed")}>
                  Use transformed results
                </Button>
                <Button size="sm" variant={transformChoice === "raw" ? "default" : "outline"}
                  onClick={() => onTransformChoiceChange("raw")}>
                  Keep raw results
                </Button>
                <Button size="sm" variant="ghost" onClick={onToggleTransformWhy}>
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

      {response.failed_traits.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-destructive font-medium mb-1">
              <AlertTriangle className="h-4 w-4" /> Failed Response Variables
            </div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {response.failed_traits.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {Object.entries(response.trait_results).map(([trait, tr]) => {
        if (tr.status !== "success" || !tr.analysis_result) return null;
        const r = tr.analysis_result.result;
        if (!r) return null;

        // Governed CRD/RCBD presentation renders only when the backend
        // actually sent the decision objects. A legacy result without them
        // keeps the existing panel and is never relabelled "governed".
        const governed = isGovernedOneFactor(r, design);
        const governedFactorial = isGovernedFactorial(r, design);
        const governedSplitPlot = isGovernedSplitPlot(r, design);

        return (
          <div key={trait} className="space-y-3">
            <h3 className="text-base font-semibold text-foreground px-1">{trait}</h3>
            {governed && (
              <GovernedOneFactorPanel
                design={design}
                result={r}
                mapping={{ treatment: context.mapping.treatment ?? "", rep: context.mapping.rep ?? "" }}
                inferentialAlpha={alpha}
              />
            )}
            {governedFactorial && (
              <GovernedFactorialPanel
                design={design}
                result={r}
                mapping={{ rep: context.mapping.rep ?? "" }}
                inferentialAlpha={alpha}
              />
            )}
            {isGovernedOneFactor(r, design) &&
              explorationEligibility(design, r, tr.status, response.export_token).available && (
                <RcbdTransformationPanel
                  trait={trait}
                  rawAnalysisToken={response.export_token as string}
                  alpha={alpha}
                  rawResult={r}
                />
              )}
            {governedSplitPlot && (
              <GovernedSplitPlotPanel
                result={r}
                mapping={{
                  rep: context.mapping.rep ?? "",
                  mainPlot: context.mapping.main_plot ?? "",
                  subPlot: context.mapping.sub_plot ?? "",
                }}
                inferentialAlpha={alpha}
              />
            )}
            <AcademicResultsPanel
              moduleLabel="ANOVA"
              domainNeutral
              insightSummary={describeResultScale(r)}
              interpretation={tr.analysis_result.interpretation || ""}
              statisticalNotes={
                tr.data_warnings.length > 0
                  ? tr.data_warnings.map((w) => ({ text: w }))
                  : undefined
              }
              inferentialAlpha={alpha}
              anovaTable={r.anova_table}
              meanSeparation={isSplitPlot || governedFactorial ? undefined : r.mean_separation}
              descriptiveStats={buildDescriptiveStats(r)}
            />
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  datasetContext: DatasetContext | null;
}

export function AnovaModulePanel({ datasetContext }: Props) {
  const { toast } = useToast();
  const [design, setDesign] = useState<GovernedDesignType>("rcbd");
  const [alpha, setAlpha] = useState<AnovaAlpha>(DEFAULT_ALPHA);
  const [structuralError, setStructuralError] = useState<ReturnType<typeof describeStructuralError> | null>(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Mappings (per-design)
  const [treatmentCol, setTreatmentCol] = useState<string>("");
  const [repColumn, setRepColumn] = useState<string>("");
  const [factorA, setFactorA] = useState<string>("");
  const [factorB, setFactorB] = useState<string>("");
  const [mainPlot, setMainPlot] = useState<string>("");
  const [subPlot, setSubPlot] = useState<string>("");

  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  /** Declared response scale per trait. Default is Unknown for every trait. */
  const [responseSemantics, setResponseSemantics] = useState<Record<string, ResponseSemantic>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // W1-UI-04 — the fingerprint of the experimental structure the researcher
  // last explicitly confirmed, or null if nothing has been confirmed yet.
  // Deliberately a plain fingerprint-equality check rather than a boolean
  // flag with explicit invalidation call sites: comparing against the
  // freshly recomputed current fingerprint on every render means dataset,
  // design or structural-role changes invalidate automatically, with no
  // separate "clear confirmation" handler to keep in sync as new mutation
  // paths are added later.
  const [confirmedRoleFingerprint, setConfirmedRoleFingerprint] = useState<string | null>(null);
  // W1-INT-06: a result is bound, permanently, to the exact scientific
  // context that produced it -- never to whatever the form currently
  // contains. See analysisIdentity.ts for why `setResults(res)` alone was
  // unsafe: a response could (and, reproduced live, did) install and render
  // under a design/mapping/alpha the form had since changed to.
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult<UploadAnalysisResponse> | null>(null);
  /** Set once on the first successful analysis and never cleared, so a
   * cleared `analysisResult` can be told apart from "never run yet". */
  const [wasAnalyzed, setWasAnalyzed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  // Assumption-driven transformation: which branch feeds the report. Defaults to
  // "transformed" so a flagged violation is not silently ignored; "raw" keeps the
  // untransformed results (report then prints the caution disclosure).
  const [transformChoice, setTransformChoice] = useState<"transformed" | "raw">("transformed");
  const [showTransformWhy, setShowTransformWhy] = useState(false);

  // W1-INT-06 — closure-independent scientific identity. `identityRef.current`
  // is the SAME controller instance across every render and every async
  // closure: reading `.current`'s methods after an `await` always reflects
  // the latest mutation, never the values a stale `handleAnalyze` invocation
  // captured at its own dispatch time. This is what makes the install gate
  // (in handleAnalyze) correct where recomputing "current" from local
  // `design`/`mapping`/`alpha` state variables would not be: those variables
  // are frozen at whatever they were when that specific closure was created.
  const identityRef = useRef(
    createAnalysisIdentityController({
      datasetToken: datasetContext?.datasetToken ?? null,
      design: "rcbd",
      mapping: {},
      selectedTraits: [],
      responseSemantics: {},
      alpha: DEFAULT_ALPHA,
      module: MODULE,
      mode: datasetContext?.mode ?? "single",
    })
  );

  // The one governed path by which any scientific input may change. Every
  // onChange/onClick handler below routes through this rather than calling
  // its `useState` setter directly, so the identity controller can never
  // describe a different scientific state than the one React is about to
  // render.
  function mutateScientificInput(
    patch: Partial<ScientificInputs>,
    applyReactState: () => void
  ) {
    identityRef.current.mutate(patch);
    applyReactState();
    setAnalysisResult((current) => (current === null ? current : null));
  }

  // Dataset identity is supplied externally via the `datasetContext` prop,
  // not owned by this component's own state, so it cannot be folded into
  // `mutateScientificInput`'s call sites. `useLayoutEffect` (not the more
  // common `useEffect`) is deliberate: an ordinary effect runs after paint,
  // which would leave a window where the DOM already reflects a replacement
  // dataset while `identityRef` still fingerprints the previous one — exactly
  // the kind of gap a delayed in-flight response could exploit. A layout
  // effect runs synchronously after DOM mutations, before the browser paints
  // or any event (including a resolving promise's continuation) can observe
  // the new render, so the identity update is never late relative to what is
  // on screen.
  useLayoutEffect(() => {
    const token = datasetContext?.datasetToken ?? null;
    const mode = datasetContext?.mode ?? "single";
    const current = identityRef.current.getInputs();
    if (token === current.datasetToken && mode === current.mode) return;
    identityRef.current.mutate({ datasetToken: token, mode });
    setAnalysisResult((prev) => (prev === null ? prev : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetContext?.datasetToken, datasetContext?.mode]);

  // Lifecycle safety: on unmount, invalidate any in-flight request's identity
  // without touching the scientific fingerprint. A response resolving after
  // unmount then fails the install gate's generation check even though
  // nothing about the scientific state itself needed to change. This is
  // explicit and intentional — not reliance on React silently ignoring a
  // setState call on an unmounted component.
  useLayoutEffect(() => {
    return () => {
      identityRef.current.invalidate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const factorAColumns = allColumns.filter((col: string) => col !== factorB);
  const factorBColumns = allColumns.filter((col: string) => col !== factorA);

  const toggleTrait = (t: string) => {
    const next = selectedTraits.includes(t)
      ? selectedTraits.filter((x) => x !== t)
      : [...selectedTraits, t];
    mutateScientificInput({ selectedTraits: next }, () => setSelectedTraits(next));
  };

  // W1-INT-04A: one declaration per trait, written by trait key. Writing trait
  // A cannot touch trait B, and nothing else in the panel writes this map — so
  // changing the design, the alpha or another trait's scale leaves a
  // declaration exactly as the researcher left it. Deselecting a trait keeps
  // its declaration rather than discarding it, so re-selecting does not
  // silently reset the scale to unknown; buildAnovaRequest drops entries for
  // traits that are not currently selected.
  const setResponseSemantic = (trait: string, semantic: ResponseSemantic) => {
    const next = { ...responseSemantics, [trait]: semantic };
    mutateScientificInput({ responseSemantics: next }, () => setResponseSemantics(next));
  };

  // Wrapped structural-role and design/alpha setters — every one of these
  // routes the change through `mutateScientificInput` so the identity
  // controller can never disagree with what React is about to render.
  // Deliberately does not clear the per-role column state: switching design
  // away and back must preserve whatever the researcher already selected
  // (confirmed elsewhere as intentional). `activeMapping` already excludes
  // any role the new design doesn't use, both for the outgoing request and
  // for `canonicalAnalysisFingerprint`, so a value left over in an inactive
  // role cannot affect either.
  const changeDesign = (v: GovernedDesignType) =>
    mutateScientificInput({ design: v }, () => setDesign(v));
  const changeAlpha = (a: AnovaAlpha) => mutateScientificInput({ alpha: a }, () => setAlpha(a));
  const changeTreatment = (v: string) =>
    mutateScientificInput(
      { mapping: { ...identityRef.current.getInputs().mapping, treatment: v } },
      () => setTreatmentCol(v)
    );
  const changeRep = (v: string) =>
    mutateScientificInput(
      { mapping: { ...identityRef.current.getInputs().mapping, rep: v } },
      () => setRepColumn(v)
    );
  const changeFactorA = (v: string) =>
    mutateScientificInput(
      { mapping: { ...identityRef.current.getInputs().mapping, factor_a: v } },
      () => setFactorA(v)
    );
  const changeFactorB = (v: string) =>
    mutateScientificInput(
      { mapping: { ...identityRef.current.getInputs().mapping, factor_b: v } },
      () => setFactorB(v)
    );
  const changeMainPlot = (v: string) =>
    mutateScientificInput(
      { mapping: { ...identityRef.current.getInputs().mapping, main_plot: v } },
      () => setMainPlot(v)
    );
  const changeSubPlot = (v: string) =>
    mutateScientificInput(
      { mapping: { ...identityRef.current.getInputs().mapping, sub_plot: v } },
      () => setSubPlot(v)
    );

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

  // W1-UI-04 — confirmation fingerprint contract: dataset identity + design +
  // active structural-role mapping ONLY. Deliberately excludes alpha, trait
  // selection and response semantics (unlike W1-INT-06's analysis-result
  // fingerprint above) so changing those never forces the researcher to
  // reconfirm an experimental structure they were never asked about.
  const roleFingerprint = canonicalRoleConfirmationFingerprint({
    datasetToken: datasetContext.datasetToken ?? null,
    design,
    mapping,
  });
  const rolesConfirmed = confirmedRoleFingerprint !== null && confirmedRoleFingerprint === roleFingerprint;
  const rolesPreviouslyConfirmedNowInvalid =
    confirmedRoleFingerprint !== null && confirmedRoleFingerprint !== roleFingerprint;

  const preview = buildStructuralPreview(
    design,
    mapping,
    alpha,
    (datasetContext.dataPreview ?? []) as Record<string, unknown>[]
  );

  const isSplitPlot = design === "split_plot_rcbd";
  const isFactorialFamily = design === "factorial_crd" || design === "factorial_rcbd";
  const roles = requiredRoles(design);

  // ── Run analysis ──────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (validation) return;
    // W1-UI-04 — an additional boundary on top of W1-INT-02's structural
    // validation above, not a replacement for it: the mapping can be
    // structurally valid and still not yet be the mapping the researcher has
    // explicitly told VivaSense to treat as the experimental roles.
    if (!rolesConfirmed) return;

    // W1-INT-06 — captured synchronously, before any await. `beginDispatch`
    // increments the generation (so a later, distinct dispatch is always
    // distinguishable from this one) and returns the fingerprint exactly as
    // it stands right now. `context` is an immutable snapshot of the same
    // moment: whatever the result-rendering path later reads from it can
    // never be altered by a subsequent form change.
    const { generation: myGeneration, fingerprint: dispatchFingerprint } =
      identityRef.current.beginDispatch();
    const context = snapshotAnalysisContext(identityRef.current.getInputs(), myGeneration);

    setIsAnalyzing(true);
    setAnalysisResult(null);
    // Hoisted so the failure path reports the same fields and elapsed time.
    const startedAt = performance.now();
    const historyBase = {
      analysisType: "anova" as const,
      backendEndpoint: "/genetics/analyze-upload?module=anova",
      datasetName: datasetContext.file.name,
      datasetToken: context.datasetToken,
      designType: context.design,
      traits: context.selectedTraits,
      startedAt,
      parameters: { design_type: context.design, alpha: context.alpha, mode: context.mode },
    };
    try {
      console.log("[MODULE]", MODULE, "[DESIGN]", context.design, "[ALPHA]", context.alpha);
      console.log("[handleAnalyze] Running ANOVA with traits:", context.selectedTraits);

      const request = buildAnovaRequest({
        datasetContext,
        design: context.design,
        alpha: context.alpha,
        mapping: context.mapping,
        traits: context.selectedTraits,
        responseSemantics: context.responseSemantics,
      });

      const res = await analyzeUpload(request);

      // Response-install gate. BOTH must still hold: no newer request has
      // been dispatched (request identity), AND no scientific input has
      // changed since dispatch even if no second request was ever sent
      // (scientific identity). `isStillCurrent` reads the controller's live
      // state directly, not anything this closure captured, so it is
      // correct no matter how long the await took or how many renders have
      // happened since. Either check failing means this response no longer
      // describes anything the researcher is currently looking at: discard
      // it silently — no result, no toast, no history record, no export.
      if (!identityRef.current.isStillCurrent(myGeneration, dispatchFingerprint)) {
        return;
      }

      setAnalysisResult({ response: res, context });
      setWasAnalyzed(true);
      // A trait can fail structurally while the HTTP call succeeds — the
      // backend rejects invalid structures before fitting rather than
      // returning a partial model, so surface the reason here.
      const firstFailure = Object.values(res.trait_results ?? {}).find(
        (tr) => tr.status === "failed" && tr.error
      );
      setStructuralError(firstFailure?.error ? describeStructuralError(firstFailure.error) : null);
      const successCount = Object.values(res.trait_results).filter((tr) => tr.status === "success").length;
      toast({ title: "ANOVA complete", description: `${pl(successCount, "response variable")} analyzed.` });

      // Persist to Research Analysis History (best-effort; never blocks the flow).
      void recordAnalysis({ ...historyBase, response: res });
    } catch (err: any) {
      if (!identityRef.current.isStillCurrent(myGeneration, dispatchFingerprint)) {
        return; // a superseded request's own failure is not the researcher's problem
      }
      void recordAnalysisFailure(historyBase, err);
      toast({ title: "ANOVA failed", description: err.message, variant: "destructive" });
    } finally {
      // Reset the in-flight flag whenever no newer request has taken over
      // responsibility for it — deliberately NOT the fuller `isStillCurrent`
      // check, which also considers the fingerprint: a form change with no
      // second request ever dispatched must still free the "Run Analysis"
      // button, or it would remain disabled forever with nothing left to
      // reset it.
      if (identityRef.current.isCurrentGeneration(myGeneration)) {
        setIsAnalyzing(false);
      }
    }
  };

  // ── Download report ───────────────────────────────────────────────────
  // W1-INT-06: operates exclusively on analysisResult.response / .context —
  // never on live form state. If the analysis-identity inputs have changed
  // since this result was installed, analysisResult is already null (the
  // governed mutation path clears it), so there is nothing to download; this
  // function is unreachable in that state because the button that calls it
  // only renders inside `{analysisResult && (...)}`.
  const handleDownload = async () => {
    if (!analysisResult) return;
    const { response, context } = analysisResult;
    setExportError(null);
    setIsDownloading(true);
    try {
      // Governed route: send the FULL analysis response and echo the exact
      // export_token the backend issued. The hand-assembled payload below
      // cannot carry governed content — it drops the decision objects, the
      // profiles, the separation statuses and the token itself — so it is now
      // reserved for legacy results that never had a token.
      if (chooseExportRoute(response) === "governed") {
        const governed = buildGovernedExportPayload(response, { module: MODULE });
        const blob = await downloadReport(MODULE, governed);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VivaSense_ANOVA_${context.design}_${new Date().toISOString().slice(0, 10)}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        sonnerToast.success("ANOVA report downloaded");
        return;
      }

      const resultIsSplitPlot = context.design === "split_plot_rcbd";
      const payload = {
        analysis_type: MODULE,
        design_type: context.design,
        dataset_summary: response.dataset_summary,
        summary_table: response.summary_table,
        trait_results: Object.fromEntries(
          Object.entries(response.trait_results)
            .filter(([, tr]) => tr.status === "success" && tr.analysis_result)
            .map(([trait, tr]) => {
              const ar = tr.analysis_result;
              const result = ar?.result;
              return [trait, {
                anova_table: result?.anova_table,
                mean_separation: resultIsSplitPlot ? undefined : result?.mean_separation,
                grand_mean: result?.grand_mean,
                n_genotypes: result?.n_genotypes,
                n_reps: result?.n_reps,
                interpretation: ar?.interpretation || "",
              }];
            })
        ),
        failed_traits: response.failed_traits,
        transformation_choice: transformChoice,
      };

      const blob = await downloadReport(MODULE, payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VivaSense_ANOVA_${context.design}_${new Date().toISOString().slice(0, 10)}.docx`;
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
    label, value, onChange, placeholder = "Select column…", options = allColumns, disabled = false,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    options?: string[];
    disabled?: boolean;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
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
          <Tabs value={design} onValueChange={(v) => changeDesign(v as GovernedDesignType)}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
              {GOVERNED_DESIGNS.map((d) => (
                <TabsTrigger key={d.id} value={d.id} className="text-xs sm:text-sm" disabled={isAnalyzing}>
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="rounded-md border bg-muted/30 p-3 flex gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{designMeta(design).hint}</span>
          </div>

          {/* Field mapping — driven by the design's required roles */}
          <div className="grid gap-4 sm:grid-cols-2">
            {roles.includes("treatment") && (
              <ColumnSelect label="Treatment / Factor Column" value={treatmentCol} onChange={changeTreatment} disabled={isAnalyzing} />
            )}
            {roles.includes("factor_a") && (
              <ColumnSelect label="Factor A Column" value={factorA} onChange={changeFactorA} options={factorAColumns} disabled={isAnalyzing} />
            )}
            {roles.includes("factor_b") && (
              <ColumnSelect label="Factor B Column" value={factorB} onChange={changeFactorB} options={factorBColumns} disabled={isAnalyzing} />
            )}
            {roles.includes("main_plot") && (
              <ColumnSelect label="Whole-Plot Factor Column" value={mainPlot} onChange={changeMainPlot} disabled={isAnalyzing} />
            )}
            {roles.includes("sub_plot") && (
              <ColumnSelect label="Subplot Factor Column" value={subPlot} onChange={changeSubPlot} disabled={isAnalyzing} />
            )}
            {roles.includes("rep") && (
              <ColumnSelect label="Replication / Block Column" value={repColumn} onChange={changeRep} disabled={isAnalyzing} />
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
                  onClick={() => changeAlpha(a)}
                  aria-pressed={alpha === a}
                  disabled={isAnalyzing}
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
              Describes the structure implied by your mapping and the preview rows. Whether the design is
              actually balanced and complete is checked by the analysis engine against the full dataset.
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
                  <Checkbox
                    checked={selectedTraits.includes(t)}
                    onCheckedChange={() => toggleTrait(t)}
                    disabled={isAnalyzing}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* Response scale — declared per trait, never inferred */}
          {selectedTraits.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-sm font-medium">Response scale</Label>
              <p className="text-xs text-muted-foreground">
                Select the measurement scale only if known. VivaSense will not infer percentage or
                proportion status from the values alone.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedTraits.map((t) => (
                  <ResponseScaleRow
                    key={t}
                    trait={t}
                    value={responseSemantics[t] ?? "unknown"}
                    onChange={(v) => setResponseSemantic(t, v)}
                    disabled={isAnalyzing}
                  />
                ))}
              </div>
            </div>
          )}

          {validation && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> {validation}
            </div>
          )}

          {structuralError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-2"
            >
              <p className="font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Design structure rejected
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

          {/* W1-UI-04 — the researcher must explicitly confirm the exact
              current mapping before it may be used as the experimental
              structure of an inferential model. A mapping merely being
              complete and structurally valid is not confirmation: this
              summary and action only render once `validation` is clear, and
              the fingerprint used for confirmation is recomputed fresh on
              every render, so any dataset/design/structural-role change is
              reflected here immediately, before the researcher can act on
              stale information. */}
          {!validation && (
            <div className="rounded-md border p-3 space-y-2" data-testid="role-confirmation">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Experimental roles
              </p>
              <p className="text-xs text-muted-foreground">
                VivaSense will use the columns below as the experimental structure of this analysis.
                Confirming does not change how the data is interpreted — it records that you have
                reviewed and approved this mapping.
              </p>
              <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-3 border-b border-dashed py-0.5">
                  <dt className="text-muted-foreground">Design</dt>
                  <dd className="font-medium text-right">{designMeta(design).fullLabel}</dd>
                </div>
                {roles.map((role) => (
                  <div key={role} className="flex justify-between gap-3 border-b border-dashed py-0.5">
                    <dt className="text-muted-foreground">{ROLE_LABELS[role]}</dt>
                    <dd className="font-medium text-right">{mapping[role]}</dd>
                  </div>
                ))}
              </dl>
              {isSplitPlot && (
                <p className="text-xs text-muted-foreground">
                  Whole plots are organized within blocks; subplots are organized within whole plots.
                </p>
              )}
              {rolesConfirmed ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Experimental roles confirmed.
                </p>
              ) : (
                <>
                  {rolesPreviouslyConfirmedNowInvalid && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      The mapping changed since you last confirmed it. Please review and confirm again
                      before running.
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmedRoleFingerprint(roleFingerprint)}
                    disabled={isAnalyzing}
                  >
                    Confirm experimental roles
                  </Button>
                </>
              )}
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !!validation || !rolesConfirmed}
            className="gap-2"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Analysis
          </Button>
        </CardContent>
      </Card>

      {/* W1-INT-06 — shown once a prior result has been invalidated by an
          analysis-identity input change, so "nothing changed visibly" is
          never mistaken for "this still describes the current inputs". */}
      {wasAnalyzed && !analysisResult && !isAnalyzing && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Analysis inputs changed. Run the analysis again to generate results for the current configuration.
        </div>
      )}

      {/* Results — rendered exclusively from analysisResult.context/.response.
          AnalysisResultsSection never receives live design/mapping/alpha/etc.
          as props, so it cannot describe a result using a scientific state
          different from the one that actually produced it, regardless of
          what the form above has since changed to. */}
      {analysisResult && (
        <AnalysisResultsSection
          analysisResult={analysisResult}
          transformChoice={transformChoice}
          onTransformChoiceChange={setTransformChoice}
          showTransformWhy={showTransformWhy}
          onToggleTransformWhy={() => setShowTransformWhy((v) => !v)}
          exportError={exportError}
          isDownloading={isDownloading}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
