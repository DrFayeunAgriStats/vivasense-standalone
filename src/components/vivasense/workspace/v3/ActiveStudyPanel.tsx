/**
 * Workspace V3 — Active Study panel with workflow progress ring + a literal
 * "Next step" nudge (the next incomplete pipeline stage from deriveWorkspaceState;
 * NOT a recommendation engine — it is a rule-based lookup). When there is no
 * active study, the whole panel is replaced by the amber "organize into a study"
 * banner. Never both at once.
 */
import { Lightbulb, ArrowRight, FolderKanban, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceState, WorkspaceAction } from "@/lib/workspace/workflowState";

interface Props {
  state: WorkspaceState;
  /** Unique traits observed across all recorded analyses (real, may be 0). */
  traitCount: number;
  /** Workflow completion %, whole number, from real stage state. */
  workflowPct: number;
  onAction: (action: WorkspaceAction) => void;
}

function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = `${(clamped / 100) * 100.5} 100.5`;
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" className="shrink-0" role="img" aria-label={`${clamped}% of workflow complete`}>
      <circle cx="20" cy="20" r="16" fill="none" className="stroke-border" strokeWidth="3" />
      <circle
        cx="20" cy="20" r="16" fill="none"
        className="stroke-primary" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={dash} transform="rotate(-90 20 20)"
      />
      <text x="20" y="21.5" textAnchor="middle" className="fill-foreground font-mono" fontSize="10" fontWeight={700}>
        {clamped}%
      </text>
    </svg>
  );
}

function Dot() {
  return <span className="text-border" aria-hidden>·</span>;
}

export function ActiveStudyPanel({ state, traitCount, workflowPct, onAction }: Props) {
  const study = state.activeStudy;

  // ── Empty state — no study to attach analyses to ──────────────────────────
  if (!study) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
          <span className="text-sm text-amber-900 dark:text-amber-200">
            {state.analysisCount > 0 ? (
              <>
                <strong>{state.analysisCount} {state.analysisCount === 1 ? "analysis isn't" : "analyses aren't"} in a study.</strong>{" "}
                Group them to track progress.
              </>
            ) : (
              <><strong>No study yet.</strong> Create one to organize your research.</>
            )}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => onAction("create-study")} className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200">
          Create Study
        </Button>
      </div>
    );
  }

  const rec = state.recommended;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-4">
        <ProgressRing pct={workflowPct} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">Active Study</p>
          <p className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-foreground">
            <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{study.title}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {study.crop && <><span className="capitalize">{study.crop}</span><Dot /></>}
            <span><strong className="text-foreground">{state.uniqueDatasets}</strong> {state.uniqueDatasets === 1 ? "dataset" : "datasets"}</span>
            <Dot />
            <span><strong className="text-foreground">{traitCount}</strong> {traitCount === 1 ? "trait" : "traits"}</span>
            <Dot />
            <span><strong className="text-foreground">{state.analysisCount}</strong> {state.analysisCount === 1 ? "analysis" : "analyses"}</span>
            <Dot />
            <span><strong className="text-foreground">{study.completed_plots}/{study.total_plots}</strong> plots</span>
          </div>
        </div>
      </div>

      {/* Next-step nudge — literal next incomplete stage */}
      <button
        type="button"
        onClick={() => onAction(rec.action)}
        className="flex shrink-0 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3.5 py-2 text-left outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.05em] text-primary">Next step</span>
          <span className="block truncate text-[12px] font-semibold text-foreground">{rec.cta}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
      </button>
    </div>
  );
}
