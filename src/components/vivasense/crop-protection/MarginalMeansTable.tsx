/**
 * Treatment and Dose marginal means.
 *
 * The backend computes no Tukey letters for marginal means, so none are shown —
 * an invented grouping here would be a fabricated inference. When the
 * interaction is significant these tables are explicitly demoted.
 */
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { fmt } from "./format";
import type { MarginalMean } from "@/types/cropProtection";

interface Props {
  treatmentMeans: MarginalMean[];
  doseMeans: MarginalMean[];
  interactionSignificant: boolean;
}

function MeansTable({ title, levelHeader, rows }: {
  title: string;
  levelHeader: string;
  rows: MarginalMean[];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{levelHeader}</TableHead>
              <TableHead className="text-right">n</TableHead>
              <TableHead className="text-right">Mean</TableHead>
              <TableHead className="text-right">SE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.level}>
                <TableCell className="font-medium">{row.level}</TableCell>
                <TableCell className="text-right tabular-nums">{row.n}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(row.mean_display_scale)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(row.se_display_scale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function MarginalMeansTable({ treatmentMeans, doseMeans, interactionSignificant }: Props) {
  return (
    <div className="space-y-4">
      {interactionSignificant && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Treatment × Dose interaction is significant. Marginal means are secondary and
            should be interpreted cautiously.
          </span>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <MeansTable title="Treatment Means" levelHeader="Treatment" rows={treatmentMeans} />
        <MeansTable title="Dose Means" levelHeader="Dose" rows={doseMeans} />
      </div>
      <p className="text-xs text-muted-foreground">
        Marginal means are averaged over the other factor and are reported on the
        biological/raw scale. No Tukey grouping is computed for marginal means.
      </p>
    </div>
  );
}
