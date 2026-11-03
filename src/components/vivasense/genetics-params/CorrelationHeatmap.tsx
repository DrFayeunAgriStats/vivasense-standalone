import { getSignificanceStars } from "@/components/vivasense/results/SignificanceStars";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  traits: string[];
  /** null = not estimable / not reported: shown as "—", never as 0. */
  rMatrix: (number | null)[][];
  pMatrix: (number | null)[][];
  /** Model-based genotypic correlation (rg): estimate only, no significance legend. */
  estimateOnly?: boolean;
  coefficientLabel?: string;
}

function cellColor(r: number): string {
  if (r >= 0.7) return "bg-emerald-600 text-white";
  if (r >= 0.4) return "bg-emerald-300 dark:bg-emerald-700 text-foreground";
  if (r >= 0.1) return "bg-emerald-100 dark:bg-emerald-900/40 text-foreground";
  if (r > -0.1) return "bg-muted text-muted-foreground";
  if (r > -0.4) return "bg-red-100 dark:bg-red-900/40 text-foreground";
  if (r > -0.7) return "bg-red-300 dark:bg-red-700 text-foreground";
  return "bg-red-600 text-white";
}

function sigLabel(p: number | null): string {
  if (p == null) return "—";
  if (p < 0.001) return "p < 0.001 (***)";
  if (p < 0.01) return "p < 0.01 (**)";
  if (p < 0.05) return "p < 0.05 (*)";
  return "Not significant";
}

export function CorrelationHeatmap({ traits, rMatrix, pMatrix, estimateOnly = false, coefficientLabel = "r" }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border px-3 py-2 bg-muted" />
              {traits.map((t) => (
                <th key={t} className="border border-border px-3 py-2 bg-muted font-medium text-left whitespace-nowrap">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traits.map((rowTrait, i) => (
              <tr key={rowTrait}>
                <td className="border border-border px-3 py-2 bg-muted font-medium whitespace-nowrap">{rowTrait}</td>
                {traits.map((colTrait, j) => {
                  const r = rMatrix[i]?.[j] ?? null;
                  const p = estimateOnly ? null : pMatrix[i]?.[j] ?? null;
                  const isDiag = i === j;
                  const stars = isDiag || estimateOnly ? "" : getSignificanceStars(p);

                  const cellContent = (
                    <td
                      key={j}
                      className={`border border-border px-3 py-2 text-center font-mono text-xs cursor-default ${isDiag || r === null ? "bg-muted/60" : cellColor(r)}`}
                    >
                      {isDiag ? "1.00" : r === null ? (
                        <span className="text-muted-foreground" title="Not estimable / not reported">—</span>
                      ) : (
                        <span>
                          {r.toFixed(2)}
                          {stars && stars !== "ns" && (
                            <sup className="ml-0.5 font-sans">{stars}</sup>
                          )}
                          {stars === "ns" && (
                            <sup className="ml-0.5 font-sans text-[9px] opacity-60">ns</sup>
                          )}
                        </span>
                      )}
                    </td>
                  );

                  if (isDiag) return cellContent;

                  return (
                    <Tooltip key={j}>
                      <TooltipTrigger asChild>
                        {cellContent}
                      </TooltipTrigger>
                      <TooltipContent className="text-xs space-y-1">
                        <p className="font-semibold">{rowTrait} × {colTrait}</p>
                        <p>{coefficientLabel} = {r === null ? "not reported" : r.toFixed(4)}</p>
                        {!estimateOnly && <p>{sigLabel(p)}</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3 italic">
          {estimateOnly
            ? "Model-based genotypic correlation (rg): estimate only — no p-values or significance are reported. “—” = not estimable / not reported."
            : "Significance: *** p < 0.001, ** p < 0.01, * p < 0.05, ns = not significant. “—” = not estimable."}{" "}
          Hover over cells for details.
        </p>
      </div>
    </TooltipProvider>
  );
}
