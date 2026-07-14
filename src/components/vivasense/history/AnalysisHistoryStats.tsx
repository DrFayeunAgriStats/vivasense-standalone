/**
 * AnalysisHistoryStats — real, derived summary tiles for the Research Dashboard.
 *
 * Every number comes from computeStats() over actual analysis_history rows.
 * Nothing here is hardcoded or fabricated.
 */
import { Database, FolderKanban, ListChecks, Timer } from "lucide-react";
import { computeStats, formatDuration } from "@/services/history/historyDashboard";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

interface Props {
  /** All of the user's records (unfiltered) — stats describe the whole history. */
  records: AnalysisHistoryRecord[];
}

interface Tile {
  label: string;
  value: string;
  icon: typeof Database;
}

export function AnalysisHistoryStats({ records }: Props) {
  const stats = computeStats(records);
  const tiles: Tile[] = [
    { label: "Total Analyses", value: String(stats.total), icon: ListChecks },
    { label: "Unique Datasets", value: String(stats.uniqueDatasets), icon: Database },
    { label: "Studies", value: String(stats.studies), icon: FolderKanban },
    {
      label: "Average Runtime",
      value: stats.avgRuntimeMs == null ? "—" : formatDuration(stats.avgRuntimeMs),
      icon: Timer,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.label}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold text-foreground leading-tight tabular-nums">
                {t.value}
              </div>
              <div className="text-xs text-muted-foreground truncate">{t.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
