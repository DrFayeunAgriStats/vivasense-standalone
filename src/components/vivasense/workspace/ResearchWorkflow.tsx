/**
 * Research workflow strip — informational pipeline from study planning to report.
 * Stage status (done / current / upcoming) is derived from real data upstream.
 * Scrolls horizontally on small screens.
 */
import { Check } from "lucide-react";
import type { WorkflowStage } from "@/lib/workspace/workflowState";

export function ResearchWorkflow({ stages }: { stages: WorkflowStage[] }) {
  return (
    <section className="rounded-xl border border-border bg-card/40 p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Research Workflow
      </h2>
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-1">
          {stages.map((s, i) => (
            <li key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    s.status === "done"
                      ? "border-primary bg-primary text-primary-foreground"
                      : s.status === "current"
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {s.status === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] ${
                    s.status === "current" ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <span className={`mx-0.5 h-px w-6 shrink-0 ${s.status === "done" ? "bg-primary" : "bg-border"}`} />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
