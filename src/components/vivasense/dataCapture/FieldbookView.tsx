/**
 * Fieldbook table — plot list for a study with search, filters, progress, and
 * status badges. Read-only here; opening a plot delegates to the parent.
 */
import { useMemo, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Plot } from "@/types/dataCapture";

/** Status badge styling for a plot. */
function statusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case "completed": return { label: "Completed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "in_progress": return { label: "In Progress", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    default: return { label: "Not Started", className: "bg-muted text-muted-foreground" };
  }
}

type FilterId = "all" | "completed" | "incomplete" | "mine" | "today";

interface Props {
  plots: Plot[];
  currentUserId: string | null;
  onOpenPlot: (plot: Plot) => void;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "incomplete", label: "Incomplete" },
  { id: "mine", label: "My entries" },
  { id: "today", label: "Today" },
];

export function FieldbookView({ plots, currentUserId, onOpenPlot }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const completed = plots.filter((p) => p.status === "completed").length;
  const pct = plots.length > 0 ? Math.round((completed / plots.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plots.filter((p) => {
      if (filter === "completed" && p.status !== "completed") return false;
      if (filter === "incomplete" && p.status === "completed") return false;
      if (filter === "mine" && p.observer_id !== currentUserId) return false;
      if (filter === "today" && !isToday(p.updated_at)) return false;
      if (q) {
        const hay = [String(p.plot_number), p.treatment, String(p.replication ?? ""), p.observer_name]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [plots, search, filter, currentUserId]);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-foreground">Plots Completed</span>
          <span className="tabular-nums text-muted-foreground">{completed} / {plots.length} · {pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plot, treatment, rep, observer…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`h-9 px-3 rounded-md border text-xs transition-colors ${
                filter === f.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table (scrolls on small screens) */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {plots.length === 0 ? "No plots for this study yet." : "No plots match your search/filters."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">Plot</th>
                <th className="px-3 py-2.5 text-left">Rep</th>
                <th className="px-3 py-2.5 text-left">Treatment</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Observer</th>
                <th className="px-3 py-2.5 text-left">Last Updated</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const s = statusMeta(p.status);
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpenPlot(p)}>
                    <td className="px-3 py-3 font-medium text-foreground">#{p.plot_number}</td>
                    <td className="px-3 py-3 text-muted-foreground">{p.replication ?? "—"}</td>
                    <td className="px-3 py-3 text-foreground">{p.treatment ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}>{s.label}</span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{p.observer_name ?? "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{fmtWhen(p.updated_at)}</td>
                    <td className="px-3 py-3 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
