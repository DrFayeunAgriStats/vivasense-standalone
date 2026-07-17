import { useEffect, useState } from "react";
import { pl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History as HistoryIcon, Loader2, FileSpreadsheet, CheckCircle2,
  FolderOpen, RefreshCw, GitCompare, Download,
} from "lucide-react";
import { listRecentAnalyses } from "@/services/history/historyService";
import { analysisLabel } from "@/services/history/historyMapper";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

interface Props {
  limit?: number;
  /** Optional injected rows for preview/testing; when set, no fetch occurs. */
  records?: AnalysisHistoryRecord[];
}

function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * "Recent Analyses" — display-only history for the authenticated user (Phase 1).
 * Row actions are placeholders (Open / Re-run / Compare / Download) wired in a
 * later phase. Shows an honest empty state; never fabricates sample rows.
 */
export function RecentAnalyses({ limit = 10, records }: Props) {
  const [rows, setRows] = useState<AnalysisHistoryRecord[] | null>(records ?? null);
  const [loading, setLoading] = useState(records == null);

  useEffect(() => {
    if (records != null) return;
    let active = true;
    setLoading(true);
    listRecentAnalyses(limit).then((r) => {
      if (active) { setRows(r); setLoading(false); }
    });
    return () => { active = false; };
  }, [limit, records]);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <HistoryIcon className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Recent Analyses</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="py-10 text-center">
          <FileSpreadsheet className="h-9 w-9 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No analyses yet.</p>
          <p className="text-xs text-muted-foreground/70">
            Run an analysis and it will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const when = formatWhen(r.created_at);
            return (
              <li key={r.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {r.analysis_title || analysisLabel(r.analysis_type)}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                      {analysisLabel(r.analysis_type)}
                    </Badge>
                    {r.design_type && (
                      <Badge variant="outline" className="text-[11px]">
                        {r.design_type.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {r.dataset_name && (
                      <span className="inline-flex items-center gap-1">
                        <FileSpreadsheet className="h-3 w-3" /> {r.dataset_name}
                      </span>
                    )}
                    {r.traits && r.traits.length > 0 && (
                      <span>{pl(r.traits.length, "trait")}</span>
                    )}
                    <span>{when.date} · {when.time}</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Success
                </span>

                {/* Placeholder actions — enabled in a later phase */}
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled title="Open results (coming soon)">
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled title="Re-run (coming soon)">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled title="Compare (coming soon)">
                    <GitCompare className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled title="Download (coming soon)">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
