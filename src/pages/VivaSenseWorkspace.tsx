import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getVivaSenseMode, subscribeVivaSenseMode, isProMode, classifyAnovaRequest, classifyGeneticsRequest } from "@/lib/vivasenseGating";
import { ArrowLeft, AlertCircle, LayoutGrid, Sigma, Dna, Sparkles, ArrowRight, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layout } from "@/components/layout/Layout";
import { VivaSenseForm, type AnalysisType } from "@/components/vivasense/VivaSenseForm";
import { VivaSenseGeneticsForm, type GeneticsAnalysisType } from "@/components/vivasense/VivaSenseGeneticsForm";
import { VivaSenseResults } from "@/components/vivasense/VivaSenseResults";
import VivaSenseResultsDisplay from "@/components/vivasense/VivaSenseResultsDisplay";
import { AdvancedAnalysisDashboard } from "@/components/vivasense/advanced/AdvancedAnalysisDashboard";
import { computeAnova, computeCorrelation } from "@/lib/geneticsUploadApi";
import { computeDescriptiveStats } from "@/lib/descriptiveStatsApi";
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

  const handleAnovaSubmit = async (analysisType: AnalysisType, formData: FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      // Check Pro gating
      const guard = classifyAnovaRequest(analysisType, formData);
      if (guard && !isProMode()) {
        setError(`${guard.title}: ${guard.description}`);
        setIsLoading(false);
        return;
      }

      if (analysisType === "descriptive") {
        const columns = formData.getAll("columns") as string[];
        const byColumn = formData.get("by") as string | null;
        const result = await computeDescriptiveStats({
          base64_content: "",
          file_type: "xlsx",
          trait_columns: columns,
          genotype_column: null,
          rep_column: null,
          expected_replication: 1,
        });
        setAnalysisState({
          type: "descriptive",
          analysisType,
          results: result,
          isDescriptive: true,
        });
      } else {
        const traits = formData.getAll("trait") as string[];
        const traitColumns = traits.length > 0 ? traits : [formData.get("trait") as string];
        const result = await computeAnova({
          dataset_token: formData.get("dataset_token") as string,
          trait_columns: traitColumns,
        });
        setAnalysisState({
          type: "anova",
          analysisType,
          results: result,
        });
      }

      setCurrentModule("results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

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

      const genotypeValue = formData.get("genotype") as string;
      const repValue = formData.get("block") as string | null;

      if (!genotypeValue) {
        throw new Error("Genotype column is required");
      }

      const result = await computeCorrelation({
        base64_content: "",
        file_type: "xlsx",
        genotype_column: genotypeValue,
        environment_column: (formData.get("environment") as string) || null,
        rep_column: repValue || "",
        trait_columns: (formData.getAll("selectedTraits") as string[]) || [],
      });
      setAnalysisState({
        type: "genetics",
        analysisType,
        results: result,
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
              <span className="text-foreground">Experimental Design</span>
            </nav>
            <div className="mt-4 flex items-start justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                  Design
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Experimental Design</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
                  Configure a randomized trial layout, compute required sample size, and export the plan.
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
              <VivaSenseForm
                onSubmit={handleAnovaSubmit}
                isLoading={isLoading}
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
                datasetContext={null}
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
              {analysisState.isDescriptive ? (
                <VivaSenseResultsDisplay result={analysisState.results} />
              ) : (
                <VivaSenseResults results={analysisState.results} userLevel="advanced" />
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
