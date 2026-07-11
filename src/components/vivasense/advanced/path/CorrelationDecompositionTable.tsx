import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { PathDecompositionRow } from "@/types/advancedAnalysis";

interface Props {
  rows: PathDecompositionRow[];
}

const fmt = (v: number | null | undefined, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";

const fmtPct = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
};

export function CorrelationDecompositionTable({ rows }: Props) {
  if (!rows || rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Correlation decomposition</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trait (predictor)</TableHead>
              <TableHead className="text-right">Total r</TableHead>
              <TableHead className="text-right">Direct Effect</TableHead>
              <TableHead className="text-right">Indirect Effect</TableHead>
              <TableHead className="text-right">% Direct</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.predictor}-${i}`}>
                <TableCell className="font-medium">{r.predictor}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.total_correlation, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.direct_effect, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.indirect_effect, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(r.percent_direct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
