import { ArrowRight, MapPin, User, FlaskConical, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { StudyWithProgress } from "@/types/dataCapture";

function designLabel(d: string | null): string {
  return d ? d.replace(/_/g, " ").toUpperCase() : "—";
}

export function StudyCaptureCard({ study, onContinue }: { study: StudyWithProgress; onContinue: (s: StudyWithProgress) => void }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{study.title}</h3>
        {study.experimental_design && (
          <Badge variant="secondary" className="shrink-0 text-[11px]">{designLabel(study.experimental_design)}</Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {study.researcher && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {study.researcher}</span>}
        {study.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {study.location}</span>}
        {study.crop && <span className="inline-flex items-center gap-1"><Sprout className="h-3.5 w-3.5" /> {study.crop}</span>}
        <span className="inline-flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> {study.total_plots} plots</span>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">{study.completed_plots}/{study.total_plots} plots</span>
          <span className="font-medium text-foreground tabular-nums">{study.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${study.progress}%` }} />
        </div>
      </div>

      <Button size="sm" className="mt-4 self-start" onClick={() => onContinue(study)}>
        {study.progress > 0 ? "Continue" : "Start"} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
