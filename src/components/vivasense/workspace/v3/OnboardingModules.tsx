/**
 * Workspace V3 — dismissible onboarding module cards. Clicking a card both
 * navigates to that module and dismisses the section. Dismissal persists
 * per-user (profiles.onboarding_dismissed) via the parent's onDismiss.
 */
import { FlaskConical, Dna, LineChart, X } from "lucide-react";
import type { WorkspaceAction } from "@/lib/workspace/workflowState";

interface Props {
  onNavigate: (action: WorkspaceAction) => void;
  onDismiss: () => void;
}

const MODULES: {
  icon: typeof FlaskConical;
  name: string;
  desc: string;
  action: WorkspaceAction;
  accent: string;
}[] = [
  { icon: FlaskConical, name: "Experimental Design", desc: "ANOVA, RCBD, factorial, split-plot", action: "start-analysis", accent: "text-primary bg-primary/10" },
  { icon: Dna, name: "Genetics & Breeding", desc: "Correlations, heritability, genetic params", action: "advanced", accent: "text-blue-600 bg-blue-500/10 dark:text-blue-400" },
  { icon: LineChart, name: "Advanced Analytics", desc: "PCA, cluster, BLUP, stability, GGE", action: "advanced", accent: "text-violet-600 bg-violet-500/10 dark:text-violet-400" },
];

export function OnboardingModules({ onNavigate, onDismiss }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Analysis Modules</h2>
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Dismiss <X className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.name}
              type="button"
              onClick={() => { onNavigate(m.action); onDismiss(); }}
              className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 p-2.5 text-left outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${m.accent}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11.5px] font-semibold leading-tight text-foreground">{m.name}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{m.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
