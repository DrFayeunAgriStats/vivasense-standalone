/**
 * AnalysisHistoryFilters — controlled filter bar for the Research Dashboard.
 *
 * Emits filter changes to the parent (AnalysisHistoryList), which owns state and
 * applies them client-side to the already-fetched analysis_history rows.
 */
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ANALYSIS_TYPE_OPTIONS, DATE_RANGE_OPTIONS,
  type DashboardFilters, type DateRangeId,
} from "@/services/history/historyDashboard";
import type { AnalysisTypeId } from "@/services/history/historyTypes";

interface Props {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  /** Whether any filter/search is active (enables the Clear button). */
  isFiltered: boolean;
}

export function AnalysisHistoryFilters({ filters, onChange, isFiltered }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search dataset, study, or title…"
          className="pl-9"
          aria-label="Search analyses"
        />
      </div>

      {/* Analysis type */}
      <Select
        value={filters.type}
        onValueChange={(v) => onChange({ ...filters, type: v as "all" | AnalysisTypeId })}
      >
        <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by analysis type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {ANALYSIS_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <Select
        value={filters.dateRange}
        onValueChange={(v) => onChange({ ...filters, dateRange: v as DateRangeId })}
      >
        <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by date">
          <SelectValue placeholder="All time" />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          onClick={() => onChange({ type: "all", dateRange: "all", search: "" })}
        >
          <X className="mr-1 h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
