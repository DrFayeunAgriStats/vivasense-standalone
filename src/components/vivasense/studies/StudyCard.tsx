/**
 * VivaSense — Study Management (Phase 3)
 *
 * Presentational card for a single study. Uses the project's shadcn/Tailwind
 * primitives (no external UI kit) and a local relative-time helper (no date-fns).
 */
import { CalendarClock, Sprout, FlaskConical, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StudyWithStats } from "@/services/studies/studyTypes";

interface StudyCardProps {
  study: StudyWithStats;
}

const STATUS_VARIANT: Record<string, "secondary" | "outline"> = {
  active: "secondary",
  completed: "outline",
  on_hold: "outline",
};

/** Short relative label, e.g. "just now", "3h ago", "2d ago", or a date for older. */
function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const StudyCard = ({ study }: StudyCardProps) => {
  const analysisCount = study.analysis_count;

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{study.title}</h3>
        <Badge variant={STATUS_VARIANT[study.status] ?? "outline"} className="shrink-0 text-[11px] capitalize">
          {String(study.status).replace(/_/g, " ")}
        </Badge>
      </div>

      {study.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{study.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {study.crop && (
          <span className="inline-flex items-center gap-1"><Sprout className="h-3.5 w-3.5" /> {study.crop}</span>
        )}
        {study.research_area && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {study.research_area}</span>
        )}
        {study.year != null && (
          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {study.year}</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
          {analysisCount} {analysisCount === 1 ? "analysis" : "analyses"}
        </span>
        <span className="text-muted-foreground">Updated {formatUpdated(study.updated_at)}</span>
      </div>
    </div>
  );
};
