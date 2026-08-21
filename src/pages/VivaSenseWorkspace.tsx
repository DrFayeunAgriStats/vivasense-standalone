import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { getVivaSenseMode, subscribeVivaSenseMode, isProMode, classifyGeneticsRequest } from "@/lib/vivasenseGating";
import { ArrowLeft, AlertCircle, LayoutGrid, Sigma, Dna, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layout } from "@/components/layout/Layout";
import { type AnalysisType } from "@/components/vivasense/VivaSenseForm";
import { VivaSenseGeneticsForm, type GeneticsAnalysisType } from "@/components/vivasense/VivaSenseGeneticsForm";
import VivaSenseResultsDisplay from "@/components/vivasense/VivaSenseResultsDisplay";
import { AdvancedAnalysisDashboard } from "@/components/vivasense/advanced/AdvancedAnalysisDashboard";
import { DatasetUpload } from "@/components/vivasense/genetics-params/DatasetUpload";
import { AnovaModulePanel } from "@/components/vivasense/genetics-params/AnovaModulePanel";
import { AnovaUploadResults } from "@/components/vivasense/genetics-params/AnovaUploadResults";
import { computeCorrelation, computeGeneticParameters, computeRegression, fileToBase64 } from "@/lib/geneticsUploadApi";
import { analyzeUpload, type UploadAnalysisResponse } from "@/services/geneticsUploadApi";
import { useToast } from "@/hooks/use-toast";
import { resolveEnvironmentMode } from "@/lib/environmentValidation";
import { recordAnalysis, recordAnalysisFailure } from "@/services/history/historyService";
import { AnalysisHistoryList } from "@/components/vivasense/history/AnalysisHistoryList";
import { StudyGrid } from "@/components/vivasense/studies/StudyGrid";
import { FieldLayoutGenerator } from "@/components/vivasense/FieldLayoutGenerator";
import { CropProtectionDashboard } from "@/components/vivasense/crop-protection/CropProtectionDashboard";
import { WorkspaceV3Dashboard } from "@/components/vivasense/workspace/v3/WorkspaceV3Dashboard";
import type { DatasetContext } from "@/types/geneticsUpload";

type ModuleType = "selection" | "anova" | "genetics" | "crop-protection" | "advanced" | "results" | "field-layout";
type WorkspaceSection = "overview" | "anova" | "genetics" | "advanced";

interface AnalysisState {
  type: "anova" | "genetics" | "descriptive";
  analysisType: AnalysisType | GeneticsAnalysisType;
  results: any;
  isDescriptive?: boolean;
}

export default function VivaSenseWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Open a module directly when linked from the sidebar (e.g. /workspace?module=genetics).
  useEffect(() => {
    const m = new URLSearchParams(location.search).get("module");
    if (m === "anova" || m === "genetics" || m === "advanced") {
      setError(null);
      setActiveSection(m);
      setCurrentModule(m);
    } else if (m === "crop-protection") {
      // Crop Protection has its own module screen and no overview section.
      setError(null);
      setCurrentModule("crop-protection");
    } else if (m === "field-layout") {
      setError(null);
      setCurrentModule("field-layout");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  const [mode, setMode] = useState(getVivaSenseMode());
  const [currentModule, setCurrentModule] = useState<ModuleType>("selection");
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
  const [datasetContext, setDatasetContext] = useState<DatasetContext | null>(null);

  const resolveFileType = (file: File): "csv" | "xlsx" | "xls" => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) return "csv";
    if (name.endsWith(".xls")) return "xls";
    return "xlsx";
  };

  const sectionMeta: Record<WorkspaceSection, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    overview: { label: "Overview", icon: LayoutGrid },
    anova: { label: "Experimental Design & ANOVA", icon: Sigma },
    genetics: { label: "Genetics & Breeding", icon: Dna },
    advanced: { label: "Advanced Analytics", icon: Sparkles },
  };

  useEffect(() => {
    const unsubscribe = subscribeVivaSenseMode((newMode: string) => {
      setMode(newMode as typeof mode);
    });
    return unsubscribe;
  }, []);


  // ANOVA now runs through the proven /genetics/analyze-upload flow rendered by
  // AnovaModulePanel (design-aware) + AcademicResultsPanel, wired directly into
  // the ANOVA module screen below. The old computeAnova() → /analysis/anova path,
  // which VivaSenseResultsDisplay could not render, has been removed.

  const handleGeneticsSubmit = async (analysisType: GeneticsAnalysisType, formData: FormData) => {
    setIsLoading(true);
    setError(null);
    // Hoisted out of the try so the failure path can report elapsed time and
    // resolve the same history type/endpoint the success path uses.
    const startedAt = performance.now();
    const historyType =
      analysisType === "variance_components" ? "genetic_parameters"
      : analysisType === "correlations" ? "correlation"
      : analysisType === "regression" ? "regression"
      : "anova";
    const historyEndpoint =
      historyType === "anova" ? "/genetics/analyze-upload?module=anova"
      : historyType === "genetic_parameters" ? "/analysis/genetic-parameters"
      : historyType === "correlation" ? "/genetics/correlation"
      : "/analysis/regression";
    try {
      // Check Pro gating
      const guard = classifyGeneticsRequest(analysisType);
      if (guard && !isProMode()) {
        setError(`${guard.title}: ${guard.description}`);
        setIsLoading(false);
        return;
      }

      const file = formData.get("file") as File | null;
      const genotypeValue = (formData.get("genotype") as string | null) || "";
      const repValue = (formData.get("rep") as string | null) || "";
      const environmentValue = ((formData.get("location") as string | null) || "").trim() || null;
      // Environment factors (Location x Year). Only meaningful when no explicit
      // environment column was given — the backend enforces that precedence too.
      const envFactorLocation = ((formData.get("env_factor_location") as string | null) || "").trim();
      const envFactorYear = ((formData.get("env_factor_year") as string | null) || "").trim();
      const environmentFactorColumns =
        !environmentValue && envFactorLocation && envFactorYear
          ? [envFactorLocation, envFactorYear]
          : [];
      const traitValues = ((formData.get("traits") as string | null) || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      if (!file) {
        throw new Error("Please upload a dataset file.");
      }

      const base64Content = await fileToBase64(file);
      const fileType = resolveFileType(file);

      // Guard: only treat the run as multi-environment when the selected
      // environment column actually has ≥2 distinct levels. A single-level
      // column cannot support Environment / GxE estimation, and forcing "multi"
      // makes the backend report impossible env/GxE statistics.
      // Shared resolver — the same one DatasetUpload uses. Construction and
      // rep re-nesting live in the backend engine; nothing is reimplemented here.
      const { mode: effectiveMode, downgradeReason } = await resolveEnvironmentMode(
        file,
        environmentValue,
        environmentValue || environmentFactorColumns.length >= 2 ? "multi" : "single",
        environmentFactorColumns
      );
      const effectiveEnvironment = effectiveMode === "multi" ? environmentValue : null;
      if (downgradeReason) {
        toast({ title: "Single-environment analysis", description: downgradeReason });
      }

      let result: unknown;
      let historyTraits: string[] = traitValues;

      if (analysisType === "anova") {
        if (traitValues.length < 1) {
          throw new Error("Please select at least one trait.");
        }
        if (!genotypeValue) {
          throw new Error("Please provide the treatment / genotype column.");
        }
        // Proven path: /genetics/analyze-upload?module=anova (design-aware),
        // rendered by AcademicResultsPanel — same workflow as the ANOVA module.
        result = await analyzeUpload({
          base64_content: base64Content,
          file_type: fileType,
          genotype_column: genotypeValue,
          rep_column: repValue,
          environment_column: effectiveEnvironment,
          // Applied by the backend only when environment_column is absent.
          environment_factor_columns:
            effectiveMode === "multi" ? environmentFactorColumns : [],
          trait_columns: traitValues,
          mode: effectiveMode,
          random_environment: false,
          selection_intensity: 2.04,
          module: "anova",
          design_type: repValue ? "rcbd" : "crd",
          treatment_column: genotypeValue,
        });
      } else if (analysisType === "variance_components") {
        if (traitValues.length < 1) {
          throw new Error("Please select at least one trait.");
        }
        result = await computeGeneticParameters({
          dataset_token: (formData.get("dataset_token") as string | null) || null,
          trait_columns: traitValues,
        });
      } else if (analysisType === "regression") {
        const responseVar = ((formData.get("response_col") as string | null) || "").trim();
        const predictors = ((formData.get("predictor_cols") as string | null) || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        const datasetToken = ((formData.get("dataset_token") as string | null) || "").trim();

        if (!datasetToken) {
          throw new Error("Dataset token missing. Please re-upload the dataset.");
        }
        if (!responseVar || predictors.length < 1) {
          throw new Error("Please provide one response variable and at least one predictor.");
        }

        const regression = await computeRegression({
          dataset_token: datasetToken,
          x_variable: predictors[0],
          y_variable: responseVar,
          model_type: "linear",
        });
        historyTraits = [responseVar, ...predictors];
        result = {
          ...regression,
          interpretation:
            (regression.summary_interpretation as string | undefined) ||
            (regression.plain_language_effect as string | undefined) ||
            "Regression completed.",
          requested_predictors: predictors,
          executed_predictor: predictors[0],
        };
      } else if (analysisType === "correlations") {
        if (!genotypeValue || traitValues.length < 2) {
          throw new Error("Please provide genotype and at least two traits.");
        }

        result = await computeCorrelation({
          base64_content: base64Content,
          file_type: fileType,
          genotype_column: genotypeValue,
          environment_column: effectiveEnvironment,
          rep_column: repValue,
          trait_columns: traitValues,
        });
      } else {
        throw new Error(`${analysisType} is not available in the current Railway backend.`);
      }

      setAnalysisState({
        type: analysisType === "anova" ? "anova" : "genetics",
        analysisType,
        results: result,
      });

      // Persist to Research Analysis History (best-effort, never blocking).
      // historyType/historyEndpoint are resolved above so the catch branch can
      // record the matching failure row.
      void recordAnalysis({
        analysisType: historyType,
        backendEndpoint: historyEndpoint,
        datasetName: file.name,
        datasetToken: (formData.get("dataset_token") as string | null) || null,
        designType: analysisType === "anova" ? (repValue ? "rcbd" : "crd") : null,
        traits: historyTraits,
        startedAt,
        parameters: { module: "genetics", mode: effectiveMode },
        response: result,
      });

      setDatasetContext({
        file,
        base64Content,
        fileType,
        genotypeColumn: genotypeValue,
        repColumn: repValue,
        environmentColumn: effectiveEnvironment,
        availableTraitColumns: traitValues,
        mode: effectiveMode,
        datasetToken: null,
      });

      setCurrentModule("results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      // Failure row mirrors the success row's type/endpoint. Dataset-level
      // fields are not all in scope here (the throw may predate them), so only
      // what is reliably known is recorded — nothing is invented.
      void recordAnalysisFailure(
        {
          analysisType: historyType,
          backendEndpoint: historyEndpoint,
          startedAt,
          parameters: { requested_analysis: analysisType },
        },
        err,
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToResults = () => {
    setCurrentModule("results");
  };

  const handleBackToModules = () => {
    setActiveSection("overview");
    setCurrentModule("selection");
    setAnalysisState(null);
    setError(null);
  };

  return (
    <Layout>
      <div className="bg-background flex-1">
        {currentModule === "selection" && (
          <>
            {/* V3 research dashboard — the default overview (also at /workspace-v2) */}
            <WorkspaceV3Dashboard />

            {/* Studies list + full analysis history (not covered by the V3 hero) */}
            <div className="mx-auto w-full max-w-[820px] space-y-6 px-4 pb-12 sm:px-6">
              <StudyGrid />
              <section id="research-dashboard">
                <AnalysisHistoryList />
              </section>
            </div>
          </>
        )}

        {/* ANOVA Form Screen */}
        {currentModule === "anova" && (
          <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <button onClick={handleBackToModules} className="hover:text-foreground">Dashboard</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Modules</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">ANOVA</span>
            </nav>
            <div className="mt-4 flex items-start justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                  Experimental Design
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  Experimental Design & ANOVA
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
                  Upload a dataset, choose the experimental design, and analyse one or more response variables using treatment comparisons, mean separation, diagnostics, and interpretation per trait.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/help">View Guide</Link>
              </Button>
            </div>
            <div className="mt-8 space-y-6">
              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
              <DatasetUpload
                onDatasetReady={setDatasetContext}
                datasetContext={datasetContext}
              />
              <AnovaModulePanel
                datasetContext={datasetContext}
              />
            </div>
          </div>
        )}

        {/* Genetics Form Screen */}
        {currentModule === "genetics" && (
          <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <button onClick={handleBackToModules} className="hover:text-foreground">Dashboard</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Modules</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">Genetics & Breeding</span>
            </nav>
            <div className="mt-4 flex items-start justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                  Genetics
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Genetics & Breeding</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
                  Estimate BLUPs, heritability, and genetic correlations from phenotype and marker data.
                </p>
              </div>
            </div>
            <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              {error && (
                <Alert className="mb-6 bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
              <VivaSenseGeneticsForm
                onSubmit={handleGeneticsSubmit}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}

        {/* Crop Protection Screen */}
        {currentModule === "crop-protection" && (
          <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <button onClick={handleBackToModules} className="hover:text-foreground">Dashboard</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Modules</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">Crop Protection</span>
            </nav>
            <div className="mt-4">
              <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                Crop Protection
              </span>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Crop Protection Analytics
              </h1>
            </div>
            <div className="mt-8">
              <CropProtectionDashboard
                initialWorkflow={
                  new URLSearchParams(location.search).get("workflow") === "bioassay"
                    ? "bioassay"
                    : "landing"
                }
              />
            </div>
          </div>
        )}

        {/* Advanced Modules Screen */}
        {currentModule === "advanced" && (
          <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <button onClick={handleBackToModules} className="hover:text-foreground">Dashboard</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Modules</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">Advanced Analytics</span>
            </nav>
            <div className="mt-4 flex items-start justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                  Analytics
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Advanced Analytics</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
                  Fit mixed models, run multivariate analyses, and generate AI-assisted interpretations.
                </p>
              </div>
            </div>
            <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              {error && (
                <Alert className="mb-6 bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
              <AdvancedAnalysisDashboard
                datasetContext={datasetContext}
              />
            </div>
          </div>
        )}

        {/* Field Layout Screen */}
        {currentModule === "field-layout" && (
          <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <button onClick={handleBackToModules} className="hover:text-foreground">Dashboard</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Modules</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">Field Layout</span>
            </nav>
            <div className="mt-4">
              <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                Experimental Design
              </span>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Field Layout Generator</h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
                Produce randomized plot maps, fieldbooks, and data-collection sheets for classic and Pro designs.
              </p>
            </div>
            <div className="mt-8">
              <FieldLayoutGenerator />
            </div>
          </div>
        )}

        {/* Results Screen */}
        {currentModule === "results" && analysisState && (
          <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={handleBackToModules}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                New Analysis
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              {analysisState.type === "anova" ? (
                <AnovaUploadResults results={analysisState.results as UploadAnalysisResponse} />
              ) : (
                <VivaSenseResultsDisplay result={analysisState.results} />
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
