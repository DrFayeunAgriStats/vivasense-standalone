import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getVivaSenseMode, subscribeVivaSenseMode, isProMode, classifyGeneticsRequest } from "@/lib/vivasenseGating";
import { ArrowLeft, AlertCircle, LayoutGrid, Sigma, Dna, Sparkles, ArrowRight, Plus, ChevronRight } from "lucide-react";
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
import { recordAnalysis } from "@/services/history/historyService";
import { AnalysisHistoryList } from "@/components/vivasense/history/AnalysisHistoryList";
import { StudyGrid } from "@/components/vivasense/studies/StudyGrid";
import type { DatasetContext } from "@/types/geneticsUpload";
import { FlaskConical } from "lucide-react";

type ModuleType = "selection" | "anova" | "genetics" | "advanced" | "results";
type WorkspaceSection = "overview" | "anova" | "genetics" | "advanced";

interface AnalysisState {
  type: "anova" | "genetics" | "descriptive";
  analysisType: AnalysisType | GeneticsAnalysisType;
  results: any;
  isDescriptive?: boolean;
}

interface AnalysisModuleCardProps {
  title: string;
  description: string;
  analyses: string[];
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

function AnalysisModuleCard({
  title,
  description,
  analyses,
  tone,
  icon: Icon,
  onClick,
}: AnalysisModuleCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(20,80,40,0.15)]"
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>

      <h3 className="mt-4 text-[15px] font-semibold text-foreground">
        {title}
      </h3>

      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground flex-1">
        {description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {analyses.map((a) => (
          <span
            key={a}
            className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {a}
          </span>
        ))}
      </div>

      <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
        Start Analysis
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

export default function VivaSenseWorkspace() {
  const { user } = useAuth();
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
    anova: { label: "ANOVA & Descriptive", icon: Sigma },
    genetics: { label: "Genetics & Breeding", icon: Dna },
    advanced: { label: "Advanced Analytics", icon: Sparkles },
  };

  useEffect(() => {
    const unsubscribe = subscribeVivaSenseMode((newMode: string) => {
      setMode(newMode as typeof mode);
    });
    return unsubscribe;
  }, []);

  const handleModuleSelect = (module: "anova" | "genetics" | "advanced") => {
    setError(null);
    setActiveSection(module);
    setCurrentModule(module);
  };

  // ANOVA now runs through the proven /genetics/analyze-upload flow rendered by
  // AnovaModulePanel (design-aware) + AcademicResultsPanel, wired directly into
  // the ANOVA module screen below. The old computeAnova() → /analysis/anova path,
  // which VivaSenseResultsDisplay could not render, has been removed.

  const handleGeneticsSubmit = async (analysisType: GeneticsAnalysisType, formData: FormData) => {
    setIsLoading(true);
    setError(null);
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
      const traitValues = ((formData.get("traits") as string | null) || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      if (!file) {
        throw new Error("Please upload a dataset file.");
      }

      const base64Content = await fileToBase64(file);
      const fileType = resolveFileType(file);

      const startedAt = performance.now();
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
          environment_column: environmentValue,
          trait_columns: traitValues,
          mode: environmentValue ? "multi" : "single",
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
          environment_column: environmentValue,
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

      // Persist to Research Analysis History (best-effort; success path only).
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
      void recordAnalysis({
        analysisType: historyType,
        backendEndpoint: historyEndpoint,
        datasetName: file.name,
        datasetToken: (formData.get("dataset_token") as string | null) || null,
        designType: analysisType === "anova" ? (repValue ? "rcbd" : "crd") : null,
        traits: historyTraits,
        startedAt,
        parameters: { module: "genetics", mode: environmentValue ? "multi" : "single" },
        response: result,
      });

      setDatasetContext({
        file,
        base64Content,
        fileType,
        genotypeColumn: genotypeValue,
        repColumn: repValue,
        environmentColumn: environmentValue,
        availableTraitColumns: traitValues,
        mode: environmentValue ? "multi" : "single",
        datasetToken: null,
      });

      setCurrentModule("results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
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
          <div className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-16">
            <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Research Workspace
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-[38px] md:leading-[1.15]">
                  Welcome to VivaSense
                </h1>
                <p className="mt-2 text-lg text-muted-foreground">
                  Professional statistical analysis for agricultural research.
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Choose an analysis module below to begin. Each workflow guides you from dataset upload through model configuration to publication-ready results.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => handleModuleSelect("anova")}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
                  >
                    <Plus className="h-4 w-4" />
                    Start New Analysis
                  </button>
                </div>
            </section>

            <section className="mt-14">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Analysis Modules
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <AnalysisModuleCard
                  title="Experimental Design"
                  description="Plan randomized trials with power analysis, replication, and layout generation."
                  analyses={["RCBD", "Split-plot", "Factorial", "Latin square"]}
                  tone="text-primary bg-primary-soft"
                  icon={FlaskConical}
                  onClick={() => handleModuleSelect("anova")}
                />

                <AnalysisModuleCard
                  title="Genetics & Breeding"
                  description="Estimate breeding values, heritability, and marker–trait associations."
                  analyses={["BLUP", "Heritability", "GWAS", "Selection index"]}
                  tone="text-sky-700 bg-sky-50"
                  icon={Dna}
                  onClick={() => handleModuleSelect("genetics")}
                />

                <AnalysisModuleCard
                  title="Advanced Analytics"
                  description="Fit mixed models and multivariate methods with AI-assisted interpretation."
                  analyses={["Mixed models", "PCA", "AMMI", "GGE biplot"]}
                  tone="text-violet-700 bg-violet-50"
                  icon={Sparkles}
                  onClick={() => handleModuleSelect("advanced")}
                />
              </div>
            </section>

            <section className="mt-2">
              <StudyGrid />
            </section>

            <section className="mt-2">
              <AnalysisHistoryList />
            </section>
          </div>
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
                  Analysis of Variance
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">ANOVA</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
                  Upload a dataset, choose your experimental design, and analyse one or more
                  response variables — ANOVA table, ranked means with Tukey groups, diagnostics,
                  and interpretation per trait.
                </p>
              </div>
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
              <AnovaModulePanel datasetContext={datasetContext} />
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
