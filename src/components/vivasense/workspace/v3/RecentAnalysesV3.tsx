/**
 * Workspace V3 — Recent Analyses with module-adaptive metrics.
 *
 * Metrics are resolved from a config map (metricsConfig.ts) against each row's
 * result_summary; only fields that are actually present render. No fabrication:
 * rows whose statistical headline metrics were never persisted simply show the
 * dataset-dimension metrics that ARE stored. Honest empty state, no sample rows.
 */
import { ArrowRight, CheckCircle2, Clock, FileSpreadsheet, History as HistoryIcon } from "lucide-react";
import { pl } from "@/lib/utils";
import { analysisLabel } from "@/services/history/historyMapper";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";
import { resolveMetrics, MODULE_ACCENT, type MetricAccent } from "@/lib/workspace/metricsConfig";

interface Props {
  rows: AnalysisHistoryRecord[];
  loading?: boolean;
  onOpen?: (record: AnalysisHistoryRecord) => void;
  onViewAll?: () => void;
}

const ACCENT: Record<MetricAccent, { pip: string; tag: string }> = {
  primary: { pip: "bg-primary", tag: "text-primary bg-primary/10" },
  blue: { pip: "bg-blue-500", tag: "text-blue-600 bg-blue-500/10 dark:text-blue-400" },
  purple: { pip: "bg-violet-500", tag: "text-violet-600 bg-violet-500/10 dark:text-violet-400" },
  amber: { pip: "bg-amber-500", tag: "text-amber-700 bg-amber-500/10 dark:text-amber-400" },
};

function runtime(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function RecentAnalysesV3({ rows, loading, onOpen, onViewAll }: Props) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <HistoryIcon className="h-4 w-4 text-primary" /> Recent Analyses
        </h2>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 rounded text-[11px] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Loading analyses…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center shadow-sm">
          <FileSpreadsheet className="mx-auto h-9 w-9 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No analyses yet.</p>
          <p className="text-xs text-muted-foreground/70">Run an analysis and it will appear here.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const accent = ACCENT[MODULE_ACCENT[r.analysis_type] ?? "primary"];
            const metrics = resolveMetrics(r.analysis_type, r.result_summary, 5);
            const rt = runtime(r.execution_time_ms);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen?.(r)}
                  className="group w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm outline-none transition-all hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* Title row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-6 w-[3px] shrink-0 rounded ${accent.pip}`} aria-hidden />
                      <span className="truncate text-[13px] font-semibold text-foreground">
                        {r.analysis_title || analysisLabel(r.analysis_type)}
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${accent.tag}`}>
                        {analysisLabel(r.analysis_type)}
                      </span>
                      {r.design_type && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                          {r.design_type.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                      Open <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>

                  {/* Metrics row (only real, present values) */}
                  {metrics.length > 0 && (
                    <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-border/60 pt-2.5">
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        {metrics.map((m) => (
                          <div key={m.label} className="min-w-0">
                            <div className={`text-[13px] font-bold leading-none text-foreground ${m.mono ? "font-mono" : ""}`}>{m.value}</div>
                            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{m.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5 border-l border-border pl-3">
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Success
                        </span>
                        {rt && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> {rt}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                    {r.dataset_name && <span>{r.dataset_name}</span>}
                    {r.traits && r.traits.length > 0 && (
                      <><span className="text-border">·</span><span>{pl(r.traits.length, "trait")}</span></>
                    )}
                    <span className="text-border">·</span>
                    <span>{fmtDate(r.created_at)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
