/**
 * AnalysisHistoryCard — one analysis rendered as a researcher-friendly card.
 *
 * Displays only real fields from an analysis_history row. "View Details" is the
 * single active action this phase; Re-run / Compare / Download / Favorite / Delete
 * are intentionally rendered disabled (implemented in a later phase).
 */
import {
  CalendarDays, Clock, Timer, FileSpreadsheet, FolderKanban, CheckCircle2,
  Eye, RefreshCw, GitCompare, Download, Star, Trash2, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  analysisLabel, formatDate, formatTime, formatDuration, formatDesign,
} from "@/services/history/historyDashboard";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

interface Props {
  record: AnalysisHistoryRecord;
  onViewDetails: (record: AnalysisHistoryRecord) => void;
}

function Meta({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function AnalysisHistoryCard({ record: r, onViewDetails }: Props) {
  const traitCount = r.traits?.length ?? 0;

  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {r.analysis_title || analysisLabel(r.analysis_type)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[11px]">
              {analysisLabel(r.analysis_type)}
            </Badge>
            {r.design_type && (
              <Badge variant="outline" className="text-[11px]">
                {formatDesign(r.design_type)}
              </Badge>
            )}
            {r.study_name && (
              <Badge variant="outline" className="text-[11px] gap-1">
                <FolderKanban className="h-3 w-3" /> {r.study_name}
              </Badge>
            )}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {r.analysis_status === "success" ? "Success" : r.analysis_status}
        </span>
      </div>

      {/* Metadata grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {r.dataset_name && <Meta icon={FileSpreadsheet}>{r.dataset_name}</Meta>}
        <Meta icon={Layers}>{traitCount} trait{traitCount === 1 ? "" : "s"}</Meta>
        <Meta icon={CalendarDays}>{formatDate(r.created_at)}</Meta>
        <Meta icon={Clock}>{formatTime(r.created_at)}</Meta>
        <Meta icon={Timer}>{formatDuration(r.execution_time_ms)}</Meta>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <Button size="sm" variant="outline" className="h-8" onClick={() => onViewDetails(r)}>
          <Eye className="mr-1.5 h-3.5 w-3.5" /> View Details
        </Button>
        <div className="flex items-center gap-0.5">
          {([
            { icon: RefreshCw, title: "Re-run (coming soon)" },
            { icon: GitCompare, title: "Compare (coming soon)" },
            { icon: Download, title: "Download (coming soon)" },
            { icon: Star, title: "Favorite (coming soon)" },
            { icon: Trash2, title: "Delete (coming soon)" },
          ] as const).map(({ icon: Icon, title }) => (
            <Button
              key={title}
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              disabled
              title={title}
              aria-label={title}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
