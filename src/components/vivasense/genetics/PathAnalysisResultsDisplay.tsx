import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, GitBranch, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PathCoefficientRow, PathDecompositionRow, PathAnalysisResponse } from "@/types/advancedAnalysis";

interface Props {
  data: {
    tables?: {
      path_analysis?: Partial<PathAnalysisResponse>;
      [key: string]: unknown;
    };
    interpretation?: string;
    intelligence?: { [key: string]: unknown };
    [key: string]: unknown;
  };
  traitName: string;
}

const fmt4 = (v: unknown): string =>
  v == null || v === "" ? "—" : Number(v).toFixed(4);

/**
 * PathAnalysisResultsDisplay — Display path analysis results for trait correlations.
 * Uses real PathAnalysisResponse types from advancedAnalysis.ts.
 * Part of the GeneticsTraitResult workflow.
 */
export function PathAnalysisResultsDisplay({ data, traitName }: Props) {
  const tables = data.tables ?? {};
  const pathData = (tables.path_analysis as Partial<PathAnalysisResponse>) || {};
  const coeffs = (pathData.path_coefficients as PathCoefficientRow[]) || [];
  const decomp = (pathData.correlation_decomposition as PathDecompositionRow[]) || [];
  const r2 = pathData.r_squared;
  const interpretation = pathData.interpretation;

  const hasResults = coeffs.length > 0 || decomp.length > 0 || r2 != null;

  if (!hasResults) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p>Path analysis results unavailable.</p>
          <p className="text-xs mt-1">
            Run path analysis from Advanced Analytics for detailed direct/indirect effects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5 text-primary" />
            Path Analysis: {traitName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {r2 != null && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-semibold text-foreground mb-2">Model Fit</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    R²
                  </p>
                  <p className="text-2xl font-bold text-foreground">{fmt4(r2)}</p>
                </div>
              </div>
            </div>
          )}

          {coeffs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Path Coefficients
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Predictor</TableHead>
                      <TableHead className="text-right">Direct Effect</TableHead>
                      <TableHead className="text-right">SE</TableHead>
                      <TableHead className="text-right">t-statistic</TableHead>
                      <TableHead className="text-right">P-value</TableHead>
                      <TableHead className="text-center">Significant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coeffs.map((c, i) => (
                      <TableRow key={i} className="border-b border-border/50">
                        <TableCell className="text-sm font-medium">
                          {c.predictor || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {fmt4(c.direct_effect)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {fmt4(c.std_error)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {fmt4(c.t_statistic)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {c.p_value == null
                            ? "—"
                            : (c.p_value as number) < 0.001
                              ? "<0.001 ***"
                              : (c.p_value as number) < 0.01
                                ? `${fmt4(c.p_value)} **`
                                : (c.p_value as number) < 0.05
                                  ? `${fmt4(c.p_value)} *`
                                  : fmt4(c.p_value)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={c.significant ? "default" : "outline"}
                            className="text-xs"
                          >
                            {c.significant ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {decomp.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Correlation Decomposition
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Total correlation split into direct and indirect effects via other traits.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Predictor</TableHead>
                      <TableHead className="text-right">Total Correlation</TableHead>
                      <TableHead className="text-right">Direct Effect</TableHead>
                      <TableHead className="text-right">Indirect Effect</TableHead>
                      <TableHead className="text-right">% Direct</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decomp.map((d, i) => (
                      <TableRow key={i} className="border-b border-border/50">
                        <TableCell className="text-sm font-medium">
                          {d.predictor || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt4(d.total_correlation)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt4(d.direct_effect)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt4(d.indirect_effect)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt4(d.percent_direct)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {interpretation && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:bg-blue-900/20 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Interpretation
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">
                {interpretation}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
