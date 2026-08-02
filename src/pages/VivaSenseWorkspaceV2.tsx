/**
 * Research Workspace V3 (preview route: /workspace-v2).
 *
 * Study-centric dashboard: workflow stepper, active-study panel, dismissible
 * onboarding modules, module-adaptive Recent Analyses, research-metrics footer.
 * All data is REAL (Supabase studies + analysis_history via existing services);
 * nothing is fabricated. Rendered inside the app's existing Layout shell — the
 * reference mockup's standalone sidebar was preview chrome, so we reuse the real
 * app navigation instead of duplicating it.
 *
 * Rollout: this lives on a NEW route; the production /workspace is untouched.
 *
 * Navigation: workflow modules are in-page state inside /workspace (not routes).
 * /workspace already honors a `?module=anova|genetics|advanced` query param
 * (VivaSenseWorkspace.tsx), so V3 deep-links to the right module via that param —
 * NO change to the production page. Steps without a module target (field layout,
 * create study, data capture) route to /data-capture or the /workspace overview.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { listStudiesWithProgress } from "@/services/dataCapture/dataCaptureService";
import { listRecentAnalyses } from "@/services/history/historyService";
import { dismissOnboarding } from "@/services/preferences";
import { deriveWorkspaceState, type WorkspaceAction } from "@/lib/workspace/workflowState";
import { deriveStageDates } from "@/lib/workspace/stageDates";
import { WorkflowStepper } from "@/components/vivasense/workspace/v3/WorkflowStepper";
import { ActiveStudyPanel } from "@/components/vivasense/workspace/v3/ActiveStudyPanel";
import { OnboardingModules } from "@/components/vivasense/workspace/v3/OnboardingModules";
import { RecentAnalysesV3 } from "@/components/vivasense/workspace/v3/RecentAnalysesV3";
import { WorkspaceFooterMetrics } from "@/components/vivasense/workspace/v3/WorkspaceFooterMetrics";

/** Stepper stage key → the workspace action it triggers. */
const STAGE_ACTION: Record<string, WorkspaceAction> = {
  study: "create-study",
  "field-layout": "field-layout",
  "field-book": "data-capture",
  "data-collection": "data-capture",
  "dataset-upload": "start-analysis",
  descriptive: "start-analysis",
  anova: "start-analysis",
  "trait-rel": "advanced",
  advanced: "advanced",
  interpretation: "dashboard",
  report: "dashboard",
};

export default function VivaSenseWorkspaceV2() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-v3-data"],
    queryFn: async () => {
      const [studies, analyses] = await Promise.all([
        listStudiesWithProgress(),
        listRecentAnalyses(200),
      ]);
      return { studies, analyses };
    },
  });

  const studies = data?.studies ?? [];
  const analyses = data?.analyses ?? [];

  const derived = useMemo(() => {
    const state = deriveWorkspaceState(studies, analyses);
    const doneCount = state.stages.filter((s) => s.status === "done").length;
    const workflowPct = state.stages.length ? Math.round((doneCount / state.stages.length) * 100) : 0;

    const traitSet = new Set<string>();
    for (const a of analyses) for (const t of a.traits ?? []) traitSet.add(t);

    const runtimes = analyses.map((a) => a.execution_time_ms).filter((n): n is number => n != null && Number.isFinite(n));
    const avgRuntimeMs = runtimes.length ? runtimes.reduce((s, n) => s + n, 0) / runtimes.length : null;

    // Q4: publication-ready = successful analyses (all rows are 'success' today).
    const publicationReady = analyses.filter((a) => a.analysis_status === "success").length;
    const pending = analyses.length - publicationReady;

    return {
      state,
      workflowPct,
      traitCount: traitSet.size,
      stageDates: deriveStageDates(analyses),
      avgRuntimeMs,
      publicationReady,
      pending,
    };
  }, [studies, analyses]);

  const onboardingDismissed = locallyDismissed || Boolean((profile as { onboarding_dismissed?: boolean } | null)?.onboarding_dismissed);

  // WorkspaceActions that map onto /workspace's ?module= deep-link.
  const ACTION_MODULE: Partial<Record<WorkspaceAction, "anova" | "advanced" | "field-layout">> = {
    "start-analysis": "anova",
    advanced: "advanced",
    "field-layout": "field-layout",
  };

  const handleAction = (action: WorkspaceAction) => {
    if (action === "create-study" || action === "data-capture") {
      navigate("/data-capture");
      return;
    }
    const mod = ACTION_MODULE[action];
    navigate(mod ? `/workspace?module=${mod}` : "/workspace");
  };

  // Analysis type → the workspace module that hosts it (for "Open").
  const moduleForType = (type: string): "anova" | "genetics" | "advanced" =>
    type === "anova"
      ? "anova"
      : ["correlation", "regression", "genetic_parameters", "trait_association", "path_analysis"].includes(type)
        ? "genetics"
        : "advanced";

  const handleDismissOnboarding = () => {
    setLocallyDismissed(true);
    if (user?.id) void dismissOnboarding(user.id);
  };

  const recent = analyses.slice(0, 5);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-tight text-foreground">Research Workspace</h1>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {isLoading ? (
                <span className="inline-block"><Skeleton className="h-4 w-56" /></span>
              ) : (
                <>
                  {derived.state.analysisCount} {derived.state.analysisCount === 1 ? "analysis" : "analyses"} ·{" "}
                  {derived.state.uniqueDatasets} {derived.state.uniqueDatasets === 1 ? "dataset" : "datasets"} ·{" "}
                  {derived.traitCount} {derived.traitCount === 1 ? "trait" : "traits"}
                </>
              )}
            </p>
          </div>
          <Button size="sm" onClick={() => handleAction("start-analysis")} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> New Analysis
          </Button>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-3.5">
            <WorkflowStepper
              stages={derived.state.stages}
              stageDates={derived.stageDates}
              onNavigate={(key) => handleAction(STAGE_ACTION[key] ?? "dashboard")}
            />

            <ActiveStudyPanel
              state={derived.state}
              traitCount={derived.traitCount}
              workflowPct={derived.workflowPct}
              onAction={handleAction}
            />

            {!onboardingDismissed && (
              <OnboardingModules onNavigate={handleAction} onDismiss={handleDismissOnboarding} />
            )}

            <RecentAnalysesV3
              rows={recent}
              onOpen={(r) => navigate(`/workspace?module=${moduleForType(r.analysis_type)}`)}
              onViewAll={() => navigate("/workspace")}
            />

            <WorkspaceFooterMetrics
              publicationReady={derived.publicationReady}
              pending={derived.pending}
              studyCount={derived.state.studyCount}
              avgRuntimeMs={derived.avgRuntimeMs}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
