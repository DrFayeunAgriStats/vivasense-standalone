/**
 * Workspace V3 — clickable research-workflow stepper.
 *
 * Real navigation: rendered as a <nav> landmark; the active step carries
 * aria-current="step"; every step is a focusable <button>. Completed steps show
 * a check + a real completion date (mono) WHERE one exists — dates are omitted,
 * never faked, for steps without a trustworthy timestamp. Scrolls horizontally
 * on narrow (mobile/PWA) viewports.
 */
import { Check } from "lucide-react";
import type { WorkflowStage } from "@/lib/workspace/workflowState";

interface Props {
  stages: WorkflowStage[];
  /** stageKey → ISO date; only present for stages we can date honestly. */
  stageDates?: Record<string, string | undefined>;
  onNavigate: (stageKey: string) => void;
}

function shortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WorkflowStepper({ stages, stageDates, onNavigate }: Props) {
  const doneCount = stages.filter((s) => s.status === "done").length;

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Research Workflow
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {doneCount} of {stages.length} complete
        </span>
      </div>

      <nav aria-label="Research workflow" className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-start sm:min-w-0">
          {stages.map((s, i) => {
            const date = shortDate(stageDates?.[s.key]);
            const isCurrent = s.status === "current";
            const isDone = s.status === "done";
            return (
              <li key={s.key} className="flex flex-1 items-start" style={{ minWidth: 64 }}>
                <button
                  type="button"
                  onClick={() => onNavigate(s.key)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${s.label}${isDone ? " (completed)" : isCurrent ? " (current step)" : ""}`}
                  className="group flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  {/* Dot */}
                  <span
                    className={[
                      "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors",
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-card text-primary ring-2 ring-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10",
                    ].join(" ")}
                  >
                    {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : i + 1}
                  </span>
                  {/* Label */}
                  <span
                    className={[
                      "max-w-full truncate text-center text-[9.5px] leading-tight transition-colors",
                      isCurrent
                        ? "font-semibold text-primary"
                        : isDone
                          ? "font-medium text-primary/90 group-hover:text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                  {/* Date (completed, real timestamp only) / current marker */}
                  {isDone && date ? (
                    <span className="font-mono text-[8px] tracking-tight text-muted-foreground">{date}</span>
                  ) : isCurrent ? (
                    <span className="text-[8px] font-semibold text-amber-600 dark:text-amber-500">current</span>
                  ) : (
                    <span className="text-[8px] leading-none">&nbsp;</span>
                  )}
                </button>

                {/* Connector */}
                {i < stages.length - 1 && (
                  <span
                    aria-hidden
                    className={[
                      "mx-0.5 mt-[10px] h-0.5 flex-1 rounded",
                      isDone ? "bg-primary/40" : "bg-border",
                    ].join(" ")}
                    style={{ minWidth: 4 }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </section>
  );
}
