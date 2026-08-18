/**
 * Pearson correlation between selected responses.
 *
 * Ordinary Pearson correlation on treated experimental units — not a genotypic
 * or phenotypic correlation, and never labelled as one.
 */
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmt, formatP } from "./format";
import type { CorrelationRow } from "@/types/cropProtection";

export function CorrelationResults({ rows }: { rows: CorrelationRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No response pairs were selected for correlation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Response A</TableHead>
              <TableHead>Response B</TableHead>
              <TableHead className="text-right">n</TableHead>
              <TableHead className="text-right">r</TableHead>
              <TableHead className="text-right">p-value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.response_a}-${row.response_b}`}>
                <TableCell className="font-medium">{row.response_a}</TableCell>
                <TableCell className="font-medium">{row.response_b}</TableCell>
                <TableCell className="text-right tabular-nums">{row.n}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.status === "success" ? fmt(row.r, 3) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.status === "success" ? formatP(row.p_value) : "insufficient variation"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Pearson correlation on the biological/raw scale, computed from treated experimental
        units only.
      </p>
    </div>
  );
}
