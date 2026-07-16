/**
 * Research Workspace header — the refreshed landing hero, active-study summary,
 * a data-driven "Recommended Next Action", and the research workflow strip.
 *
 * All state comes from REAL data: studies via dataCapture's read service and
 * analyses via the history read service. No new backend, no mutations. While
 * loading, data-driven blocks are hidden rather than guessed.
 */
import { useEffect, useState } from "react";
import { Plus, FlaskConical, ArrowRight, Lightbulb, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listStudiesWithProgress } from "@/services/dataCapture/dataCaptureService";
import { listRecentAnalyses } from "@/services/history/historyService";
import { deriveWorkspaceState, type WorkspaceState, type WorkspaceAction } from "@/lib/workspace/workflowState";
import type { StudyWithProgress } from "@/types/dataCapture";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";
import { ResearchWorkflow } from "./ResearchWorkflow";

interface Props {
  onAction: (action: WorkspaceAction) => void;
  /** Injected data for local preview/screenshots only; when set, no fetch runs. */
  previewData?: { studies: StudyWithProgress[]; analyses: AnalysisHistoryRecord[] };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function WorkspaceOverviewHeader({ onAction, previewData }: Props) {
  const [state, setState] = useState<WorkspaceState | null>(
    previewData ? deriveWorkspaceState(previewData.studies, previewData.analyses) : null,
  );
  const [loaded, setLoaded] = useState(previewData != null);

  useEffect(() => {
    if (previewData) return;
    let active = true;
    Promise.all([listStudiesWithProgress(), listRecentAnalyses(200)])
      .then(([studies, analyses]) => { if (active) setState(deriveWorkspaceState(studies, analyses)); })
      .catch(() => { if (active) setState(null); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [previewData]);

  const activeStudy = state?.activeStudy ?? null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Research Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-[38px] md:leading-[1.15]">
          Research Workspace
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Continue your agricultural research from study planning through publication-ready analysis.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => onAction("create-study")}>
            <Plus className="mr-1.5 h-4 w-4" /> Create Study
          </Button>
          <Button variant="outline" onClick={() => onAction("start-analysis")}>
            <FlaskConical className="mr-1.5 h-4 w-4" /> Start New Analysis
          </Button>
        </div>

        {/* Active study */}
        <div className="mt-5 rounded-xl border border-border bg-card/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Active Study</p>
          {!loaded ? (
            <Skeleton className="mt-2 h-5 w-64" />
          ) : activeStudy ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <FolderKanban className="h-4 w-4 text-primary" /> {activeStudy.title}
              </span>
              <Badge variant="secondary" className="text-[11px] capitalize">{String(activeStudy.status).replace(/_/g, " ")}</Badge>
              {activeStudy.crop && <span className="text-sm text-muted-foreground">{activeStudy.crop}</span>}
              <span className="text-xs text-muted-foreground">Updated {formatWhen(activeStudy.updated_at)}</span>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">No active study selected.</p>
          )}
        </div>
      </section>

      {/* Recommended next action (real state only) */}
      {loaded && state && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lightbulb className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Recommended Next Action</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{state.recommended.title}</p>
                <p className="text-sm text-muted-foreground">{state.recommended.description}</p>
              </div>
            </div>
            <Button size="sm" className="shrink-0 self-start sm:self-center" onClick={() => onAction(state.recommended.action)}>
              {state.recommended.cta} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Workflow strip */}
      {loaded && state && <ResearchWorkflow stages={state.stages} />}
    </div>
  );
}
