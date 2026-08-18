/**
 * Factorial-CRD ANOVA table: Treatment, Dose, Treatment × Dose, Error.
 *
 * Replicate is an experimental-unit identifier in a CRD, never a model source.
 * The backend does not emit a Rep row; the filter here is a visible guarantee
 * that one could not appear even if an upstream model changed.
 */
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmt, formatP, significanceStars } from "./format";
import type { AnovaRow } from "@/types/cropProtection";

const SOURCE_LABELS: Record<string, string> = {
  Treatment: "Treatment",
  Dose: "Dose",
  "Treatment:Dose": "Treatment × Dose",
  Error: "Error",
};

/** A replicate/block source is not part of the factorial CRD model. */
const EXCLUDED_SOURCES = /^(rep|replicate|block)$/i;

interface Props {
  rows: AnovaRow[];
  alpha?: number;
}

export function AnovaResultsTable({ rows, alpha = 0.05 }: Props) {
  const modelRows = rows.filter((row) => !EXCLUDED_SOURCES.test(row.source));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">df</TableHead>
            <TableHead className="text-right">SS</TableHead>
            <TableHead className="text-right">MS</TableHead>
            <TableHead className="text-right">F</TableHead>
            <TableHead className="text-right">p-value</TableHead>
            <TableHead className="text-right">Sig.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {modelRows.map((row) => {
            const significant =
              row.p_value !== null && Number.isFinite(row.p_value) && row.p_value < alpha;
            return (
              <TableRow key={row.source}>
                <TableCell className={significant ? "font-semibold" : "font-medium"}>
                  {SOURCE_LABELS[row.source] ?? row.source}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.df}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.ss, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.ms, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.f_value, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatP(row.p_value)}</TableCell>
                <TableCell className="text-right">
                  {row.p_value === null ? "" : significanceStars(row.p_value)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        Completely randomized design. Replicate identifies independent experimental units
        and is not a model source.
      </p>
    </div>
  );
}
