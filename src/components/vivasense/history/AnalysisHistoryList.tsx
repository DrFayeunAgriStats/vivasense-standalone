/**
 * AnalysisHistoryList — the Research Dashboard container (Phase 2).
 *
 * Single source of truth: the analysis_history table, fetched ONCE via
 * historyService.fetchAnalysesForDashboard(). All statistics, filtering,
 * searching, grouping, and pagination are computed client-side from that result
 * — no mock data, no fabricated rows, no extra Supabase queries. Renders loading
 * (skeleton), error, empty, and populated states.
 */
import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, AlertTriangle, FileSpreadsheet, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAnalysesForDashboard, type DashboardFetchResult,
} from "@/services/history/historyService";
import {
  filterRecords, groupRecords, DEFAULT_FILTERS, type DashboardFilters,
} from "@/services/history/historyDashboard";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";
import { AnalysisHistoryStats } from "./AnalysisHistoryStats";
import { AnalysisHistoryFilters } from "./AnalysisHistoryFilters";
import { AnalysisHistoryCard } from "./AnalysisHistoryCard";
import { AnalysisHistoryDrawer } from "./AnalysisHistoryDrawer";

const PAGE_SIZE = 9;
/** Upper bound on rows fetched in one go; filtering/paging happen client-side. */
const FETCH_LIMIT = 200;

type Status = "loading" | "error" | "signedout" | "ready";

function CardSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-2/3" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="mt-4 h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

interface Props {
  /**
   * Optional injected rows for local component preview/screenshots. When set, no
   * Supabase fetch occurs. Never used in production render paths, which always
   * pull live analysis_history rows. Mirrors the same convention as RecentAnalyses.
   */
  previewRecords?: AnalysisHistoryRecord[];
}

export function AnalysisHistoryList({ previewRecords }: Props = {}) {
  const isPreview = previewRecords != null;
  const [status, setStatus] = useState<Status>(isPreview ? "ready" : "loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [records, setRecords] = useState<AnalysisHistoryRecord[]>(previewRecords ?? []);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<AnalysisHistoryRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (isPreview) return;
    let active = true;
    setStatus("loading");
    fetchAnalysesForDashboard(FETCH_LIMIT).then((res: DashboardFetchResult) => {
      if (!active) return;
      if (res.error) { setErrorMsg(res.error); setStatus("error"); return; }
      if (res.signedOut) { setStatus("signedout"); return; }
      setRecords(res.rows);
      setStatus("ready");
    });
    return () => { active = false; };
  }, [reloadKey, isPreview]);

  // Reset pagination whenever the filter set changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filters]);

  const isFiltered =
    filters.type !== "all" || filters.dateRange !== "all" || filters.search.trim() !== "";

  const uniqueDatasetCount = useMemo(
    () => new Set(records.map((r) => r.dataset_name).filter(Boolean)).size,
    [records],
  );
  const filtered = useMemo(() => filterRecords(records, filters), [records, filters]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const groups = useMemo(() => groupRecords(visible), [visible]);
  const hasMore = visibleCount < filtered.length;

  function openDetails(r: AnalysisHistoryRecord) {
    setSelected(r);
    setDrawerOpen(true);
  }

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <HistoryIcon className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Research Dashboard</h2>
            {status === "ready" && records.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Showing {records.length} {records.length === 1 ? "analysis" : "analyses"} across {uniqueDatasetCount} {uniqueDatasetCount === 1 ? "dataset" : "datasets"}
              </p>
            )}
          </div>
        </div>
        {status === "ready" && records.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Refresh"
          >
            <RotateCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
        )}
      </header>

      {/* Loading */}
      {status === "loading" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)}
          </div>
          <CardSkeletons />
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-9 w-9 text-destructive/70" />
          <div>
            <p className="text-sm font-medium text-foreground">Couldn’t load your analyses.</p>
            <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCw className="mr-1.5 h-4 w-4" /> Try again
          </Button>
        </div>
      )}

      {/* Signed out */}
      {status === "signedout" && (
        <div className="py-12 text-center">
          <FileSpreadsheet className="mx-auto h-9 w-9 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Sign in to see your research history.</p>
        </div>
      )}

      {/* Ready */}
      {status === "ready" && (
        <>
          {records.length === 0 ? (
            <div className="py-12 text-center">
              <FileSpreadsheet className="mx-auto h-9 w-9 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No analyses yet.</p>
              <p className="text-xs text-muted-foreground/70">Run an analysis and it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <AnalysisHistoryStats records={records} />
              <AnalysisHistoryFilters filters={filters} onChange={setFilters} isFiltered={isFiltered} />

              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No analyses match your filters.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-primary"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <>
                  {groups.map((g) => (
                    <div key={g.key}>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {g.label}
                        </h3>
                        <span className="text-xs text-muted-foreground/60">({g.records.length})</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {g.records.map((r) => (
                          <AnalysisHistoryCard key={r.id} record={r} onViewDetails={openDetails} />
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-center pt-1">
                    {hasMore ? (
                      <Button variant="outline" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                        Load more ({filtered.length - visibleCount} remaining)
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">
                        Showing all {filtered.length} matching {filtered.length === 1 ? "analysis" : "analyses"}.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <AnalysisHistoryDrawer record={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </section>
  );
}
