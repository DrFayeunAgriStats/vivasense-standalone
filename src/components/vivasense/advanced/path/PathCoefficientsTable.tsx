import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { PathCoefficientRow } from "@/types/advancedAnalysis";

interface Props {
  rows: PathCoefficientRow[];
}

const fmt = (v: number | null | undefined, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";

const fmtP = (v: number | null | undefined) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  if (v < 0.0001) return "< 0.0001";
  return v.toFixed(4);
};

export function PathCoefficientsTable({ rows }: Props) {
  if (!rows || rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Path coefficients</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trait (predictor)</TableHead>
              <TableHead className="text-right">Direct Effect (β)</TableHead>
              <TableHead className="text-right">Std Error</TableHead>
              <TableHead className="text-right">t-statistic</TableHead>
              <TableHead className="text-right">p-value</TableHead>
              <TableHead>Significant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={`${r.predictor}-${i}`}
                className={r.significant ? "border-l-4 border-l-emerald-500/70 bg-emerald-500/[0.04]" : undefined}
              >
                <TableCell className="font-medium">{r.predictor}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.direct_effect, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.std_error, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.t_statistic, 3)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtP(r.p_value)}</TableCell>
                <TableCell>
                  {r.significant ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
