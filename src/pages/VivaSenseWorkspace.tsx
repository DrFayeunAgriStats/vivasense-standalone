import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getVivaSenseMode, subscribeVivaSenseMode, isProMode, classifyAnovaRequest, classifyGeneticsRequest } from "@/lib/vivasenseGating";
import { ArrowLeft, AlertCircle, LayoutGrid, Sigma, Dna, Sparkles, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layout } from "@/components/layout/Layout";
import { VivaSenseForm, type AnalysisType } from "@/components/vivasense/VivaSenseForm";
import { VivaSenseGeneticsForm, type GeneticsAnalysisType } from "@/components/vivasense/VivaSenseGeneticsForm";
import { VivaSenseResults } from "@/components/vivasense/VivaSenseResults";
import VivaSenseResultsDisplay from "@/components/vivasense/VivaSenseResultsDisplay";
import { AdvancedAnalysisDashboard } from "@/components/vivasense/advanced/AdvancedAnalysisDashboard";
import { ModuleCard } from "@/components/vivasense/shared";
import { computeAnova, computeCorrelation } from "@/lib/geneticsUploadApi";
import { computeDescriptiveStats } from "@/lib/descriptiveStatsApi";

type ModuleType = "selection" | "anova" | "genetics" | "advanced" | "results";
type WorkspaceSection = "overview" | "anova" | "genetics" | "advanced";

interface AnalysisState {
  type: "anova" | "genetics" | "descriptive";
  analysisType: AnalysisType | GeneticsAnalysisType;
  results: any;
  isDescriptive?: boolean;
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
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="container-wide py-8 px-4 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm p-4 lg:p-5 h-fit sticky top-24">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</p>
              <h2 className="text-sm font-semibold text-foreground mt-1">Analysis Navigator</h2>
            </div>
            <nav className="space-y-1.5">
              {(Object.keys(sectionMeta) as WorkspaceSection[]).map((sectionKey) => {
                const item = sectionMeta[sectionKey];
                const Icon = item.icon;
                const isActive = activeSection === sectionKey;
                return (
                  <button
                    key={sectionKey}
                    type="button"
                    onClick={() => {
                      setActiveSection(sectionKey);
                      if (sectionKey === "overview") {
                        setCurrentModule("selection");
                      } else {
                        setCurrentModule(sectionKey as "anova" | "genetics" | "advanced");
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section>
        {/* Module Selection Screen */}
        {currentModule === "selection" && (
          <div className="max-w-6xl mx-auto">
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm p-6 md:p-8 mb-8">
              <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">VivaSense Workspace</h1>
                <p className="text-muted-foreground">Choose a module to start an analysis workflow.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <ModuleCard
                  title="ANOVA & Descriptive"
                  icon={<FileText className="w-5 h-5 text-primary" />}
                  items={["Descriptive statistics endpoint", "ANOVA analysis endpoint"]}
                  onClick={() => handleModuleSelect("anova")}
                  badgeLabel="Verified"
                />

                <ModuleCard
                  title="Genetics & Breeding"
                  icon={<Dna className="w-5 h-5 text-primary" />}
                  items={["Correlation analysis endpoint"]}
                  onClick={() => handleModuleSelect("genetics")}
                  badgeLabel="Verified"
                />

                <ModuleCard
                  title="Advanced Analytics"
                  icon={<BarChart3 className="w-5 h-5 text-primary" />}
                  items={[
                    "PCA analysis endpoint",
                    "Cluster analysis endpoint",
                    "Stability analysis endpoint",
                    "BLUP analysis endpoint",
                    "Non-parametric analysis endpoint",
                    "MANOVA analysis endpoint",
                    "Path analysis endpoint",
                    "Selection-index endpoint",
                  ]}
                  onClick={() => handleModuleSelect("advanced")}
                  badgeLabel="Endpoint Mapped"
                />
              </div>

              {/* Pro Feature Notice */}
              {!isProMode() && (
                <Alert className="mt-8 bg-primary/5 border-primary/20">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-foreground/80">
                    Some features are Pro-only (multi-environment ANOVA, genetics parameters, advanced analytics).
                    Upgrade to Pro for full access.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* ANOVA Form Screen */}
        {currentModule === "anova" && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={handleBackToModules}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Modules
              </Button>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm p-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">ANOVA & Descriptive Analysis</h2>
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={handleBackToModules}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Modules
              </Button>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm p-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Genetics & Breeding Analysis</h2>
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
          <div className="max-w-5xl mx-auto">
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={handleBackToModules}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Modules
              </Button>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm p-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Advanced Analytics</h2>
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
          <div className="max-w-5xl mx-auto">
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
            <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm p-8">
              {analysisState.isDescriptive ? (
                <VivaSenseResultsDisplay result={analysisState.results} />
              ) : (
                <VivaSenseResults results={analysisState.results} userLevel="advanced" />
              )}
            </div>
          </div>
        )}
          </section>
        </div>
        </div>
      </div>
    </Layout>
  );
}
