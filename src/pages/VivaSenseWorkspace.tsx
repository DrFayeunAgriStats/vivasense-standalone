import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getVivaSenseMode, subscribeVivaSenseMode, isProMode, classifyAnovaRequest, classifyGeneticsRequest } from "@/lib/vivasenseGating";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type ModuleType = "selection" | "anova" | "genetics" | "advanced" | "results";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeVivaSenseMode((newMode: string) => {
      setMode(newMode as typeof mode);
    });
    return unsubscribe;
  }, []);

  const handleModuleSelect = (module: "anova" | "genetics" | "advanced") => {
    setError(null);
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
    setCurrentModule("selection");
    setAnalysisState(null);
    setError(null);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="container-wide py-8 px-4">
        {/* Module Selection Screen */}
        {currentModule === "selection" && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <h1 className="text-3xl font-bold text-green-900 mb-2">VivaSense Analysis Suite</h1>
              <p className="text-gray-600 mb-8">Select an analysis module to begin</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ANOVA Module */}
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleModuleSelect("anova")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">📊</span> ANOVA & Descriptive
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>✓ Descriptive Statistics</li>
                      <li>✓ One-way ANOVA</li>
                      <li>✓ Two-way ANOVA</li>
                      <li>✓ RCBD Factorial</li>
                      <li>✓ Split-plot</li>
                      <li>✓ Multi-trait Analysis</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Genetics Module */}
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleModuleSelect("genetics")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">🧬</span> Genetics & Breeding
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>✓ Variance Components</li>
                      <li>✓ Stability Analysis</li>
                      <li>✓ AMMI & GGE</li>
                      <li>✓ Path Analysis</li>
                      <li>✓ Multivariate</li>
                      <li>✓ Molecular Markers</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Advanced Module */}
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleModuleSelect("advanced")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">🔬</span> Advanced Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>✓ BLUP Predictions</li>
                      <li>✓ PCA & Clustering</li>
                      <li>✓ Non-parametric Tests</li>
                      <li>✓ MANOVA</li>
                      <li>✓ Path Analysis</li>
                      <li>✓ Selection Index</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Pro Feature Notice */}
              {!isProMode() && (
                <Alert className="mt-8 bg-purple-50 border-purple-200">
                  <AlertCircle className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800">
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
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-green-900 mb-6">ANOVA & Descriptive Analysis</h2>
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
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-green-900 mb-6">Genetics & Breeding Analysis</h2>
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
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-green-900 mb-6">Advanced Analytics</h2>
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
            <div className="bg-white rounded-lg shadow-lg p-8">
              {analysisState.isDescriptive ? (
                <VivaSenseResultsDisplay result={analysisState.results} />
              ) : (
                <VivaSenseResults results={analysisState.results} userLevel="advanced" />
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
}
