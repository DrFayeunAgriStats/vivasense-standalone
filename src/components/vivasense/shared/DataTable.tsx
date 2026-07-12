import type { ReactNode } from "react";

interface DataTableProps {
  headers: string[];
  rows: ReactNode[][];
  rightAlignFrom?: number;
}

export function DataTable({ headers, rows, rightAlignFrom = 1 }: DataTableProps) {
  return (
    <div className="overflow-x-auto my-3 rounded-xl border border-border/70">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/60">
            {headers.map((h) => (
              <th key={h} className="border-b border-border/70 px-3 py-2 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`border-b border-border/40 px-3 py-2 text-foreground ${
                    j >= rightAlignFrom ? "text-right font-mono text-xs" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
