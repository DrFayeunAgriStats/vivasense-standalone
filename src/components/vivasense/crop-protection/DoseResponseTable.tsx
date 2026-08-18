/**
 * Dose-response regression, one row per Treatment × response.
 *
 * The untreated control is not a dose-0 point: the backend fits treated
 * observations only, and that exclusion is stated rather than assumed.
 */
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmt, formatP, regressionInterpretation } from "./format";
import type { RegressionRow } from "@/types/cropProtection";

export function DoseResponseTable({ rows }: { rows: RegressionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No responses were selected for dose-response regression.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Treatment</TableHead>
              <TableHead>Response</TableHead>
              <TableHead className="text-right">Slope</TableHead>
              <TableHead className="text-right">R²</TableHead>
              <TableHead className="text-right">p-value</TableHead>
              <TableHead>Interpretation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.response_id}-${row.treatment}`}>
                <TableCell className="font-medium">{row.treatment}</TableCell>
                <TableCell>{row.response_id}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.slope, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.r_squared, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatP(row.p_value)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {regressionInterpretation(row)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Linear fits on the biological/raw scale using treated observations only. The
        untreated control is not included as dose 0.
      </p>
    </div>
  );
}
