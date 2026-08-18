/**
 * Abbott-corrected mortality.
 *
 * The control is the reference the correction is computed against, so it has no
 * corrected value of its own — it renders as "N/A — reference", never as a
 * corrected percentage.
 */
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { fmt, fmtDose } from "./format";
import type { MortalityCorrection } from "@/types/cropProtection";

interface Props {
  correction: MortalityCorrection;
  observationTime?: number | null;
  timeUnit?: string | null;
}

export function AbbottMortalityTable({ correction, observationTime, timeUnit }: Props) {
  const timeLabel =
    observationTime === null || observationTime === undefined
      ? ""
      : ` at ${observationTime}${timeUnit ? ` ${timeUnit}` : ""}`;

  // Mean per Treatment × Dose cell — one row per experimental unit would bury
  // the pattern the researcher is reading for.
  const cells = new Map<string, {
    treatment: string; dose: number; raw: number[]; corrected: number[]; floored: boolean;
    isControl: boolean;
  }>();
  for (const row of correction.rows) {
    const key = `${row.treatment}|${row.dose}`;
    const entry = cells.get(key) ?? {
      treatment: row.treatment,
      dose: row.dose,
      raw: [],
      corrected: [],
      floored: false,
      isControl: row.abbott_status === "reference_control",
    };
    entry.raw.push(row.raw_mortality);
    if (row.display_abbott_value !== null) entry.corrected.push(row.display_abbott_value);
    entry.floored = entry.floored || row.floor_applied;
    entry.isControl = entry.isControl || row.abbott_status === "reference_control";
    cells.set(key, entry);
  }
  const rows = Array.from(cells.values()).sort(
    (a, b) => a.treatment.localeCompare(b.treatment) || a.dose - b.dose
  );
  const mean = (values: number[]) =>
    values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;

  const floorApplied = correction.rows.some((row) => row.floor_applied);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          Control mortality{timeLabel}: {fmt(correction.control_mean_raw_mortality, 1)}%
        </Badge>
        <Badge variant="outline">Control n = {correction.control_n}</Badge>
        {correction.duplicates_removed > 0 && (
          <Badge variant="outline">
            {correction.duplicates_removed} repeated control row(s) removed
          </Badge>
        )}
      </div>

      {floorApplied && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Abbott flooring was applied: corrected mortality below the control level was set
            to zero rather than reported as negative.
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Treatment</TableHead>
              <TableHead className="text-right">Dose</TableHead>
              <TableHead className="text-right">Raw mortality</TableHead>
              <TableHead className="text-right">Abbott corrected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.treatment}-${row.dose}`}>
                <TableCell className="font-medium">{row.treatment}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtDose(row.dose)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(mean(row.raw), 1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.isControl ? (
                    <span className="text-muted-foreground">N/A — reference</span>
                  ) : (
                    `${fmt(mean(row.corrected), 1)}%`
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Cell means over {correction.control_policy.replace(/_/g, " ")} control handling.
        {correction.verification.verification_status === "not_supplied"
          ? " No pre-computed Abbott column was supplied for cross-checking."
          : ` Supplied Abbott column verified (max difference ${fmt(
              correction.verification.max_absolute_difference, 4
            )}).`}
      </p>
    </div>
  );
}
