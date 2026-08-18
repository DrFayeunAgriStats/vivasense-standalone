/**
 * Treatment × Dose interaction means as a publication matrix.
 *
 * Each cell carries "mean ± SE letter" on the display (biological) scale. The
 * Tukey letters come from the declared inference variable, which is stated
 * explicitly whenever the two scales differ — the researcher must never have to
 * guess which scale a letter belongs to.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmt, fmtDose, meanSeLetter } from "./format";
import type { InteractionMean } from "@/types/cropProtection";

interface Props {
  means: InteractionMean[];
  /** Present when the ANOVA ran on a different column than the one displayed. */
  scaleNote?: { inferenceColumn: string; displayColumn: string } | null;
}

export function InteractionMeansTable({ means, scaleNote }: Props) {
  const [layout, setLayout] = useState<"matrix" | "long">("matrix");

  const treatments = Array.from(new Set(means.map((m) => m.treatment)));
  const doses = Array.from(new Set(means.map((m) => m.dose))).sort((a, b) => a - b);
  const byCell = new Map(means.map((m) => [`${m.treatment}|${m.dose}`, m]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Treatment × Dose Means</h4>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={layout === "matrix" ? "default" : "outline"}
            onClick={() => setLayout("matrix")}
          >
            Matrix
          </Button>
          <Button
            size="sm"
            variant={layout === "long" ? "default" : "outline"}
            onClick={() => setLayout("long")}
          >
            Long form
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {layout === "matrix" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treatment</TableHead>
                {doses.map((dose) => (
                  <TableHead key={dose} className="text-right">{fmtDose(dose)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {treatments.map((treatment) => (
                <TableRow key={treatment}>
                  <TableCell className="font-medium">{treatment}</TableCell>
                  {doses.map((dose) => {
                    const cell = byCell.get(`${treatment}|${dose}`);
                    return (
                      <TableCell key={dose} className="text-right tabular-nums whitespace-nowrap">
                        {cell ? meanSeLetter(cell.mean, cell.se, cell.tukey_letter) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Treatment</TableHead>
                <TableHead className="text-right">Dose</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">Mean</TableHead>
                <TableHead className="text-right">SE</TableHead>
                <TableHead className="text-right">Group</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {means.map((m) => (
                <TableRow key={`${m.treatment}-${m.dose}`}>
                  <TableCell className="font-medium">{m.treatment}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtDose(m.dose)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.n}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(m.mean)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(m.se)}</TableCell>
                  <TableCell className="text-right">{m.tukey_letter}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Means sharing at least one letter are not significantly different at α = 0.05.
        </p>
        {scaleNote && (
          <p>
            Tukey grouping is based on the declared inference variable
            (<span className="font-medium text-foreground">{scaleNote.inferenceColumn}</span>);
            means are displayed on the biological/raw scale
            (<span className="font-medium text-foreground">{scaleNote.displayColumn}</span>).
          </p>
        )}
      </div>
    </div>
  );
}
