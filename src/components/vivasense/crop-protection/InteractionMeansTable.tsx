import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { meanSeLetter } from "./format";
import type { InteractionMean } from "@/types/cropProtection";

interface Props { means: InteractionMean[]; scaleNote?: { inferenceColumn: string; displayColumn: string } | null; }
const levelsOf = (means: InteractionMean[], factor: string) => Array.from(new Set(means.map(m => String(m.factor_levels?.[factor]))));
const value = (m: InteractionMean) => meanSeLetter(m.mean_display_scale ?? m.mean, m.se_display_scale ?? m.se, m.letter ?? m.tukey_letter);

export function InteractionMeansTable({ means, scaleNote }: Props) {
  const dynamic = means[0]?.factor_levels;
  const factors = dynamic ? Object.keys(dynamic) : ["Treatment", "Dose"];
  const normalized = dynamic ? means : means.map(m => ({ ...m, factor_levels: { Treatment: m.treatment, Dose: m.dose } }));
  const facet = factors.length === 3
    ? factors.reduce((best, factor) => levelsOf(normalized, factor).length < levelsOf(normalized, best).length ? factor : best)
    : undefined;
  const remaining = factors.filter(factor => factor !== facet);
  const [row, column] = remaining;
  const facets = facet ? levelsOf(normalized, facet) : [""];
  const rows = levelsOf(normalized, row);
  const columns = column ? levelsOf(normalized, column) : [];
  return <div className="space-y-5"><h4 className="text-sm font-semibold">{factors.join(" × ")} Means</h4>
    {facets.map(facetLevel => <div key={facetLevel} className="space-y-2">{facet && <h5 className="text-sm font-medium">{facet} = {facetLevel}</h5>}
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{row}</TableHead>{columns.length ? columns.map(level => <TableHead key={level} className="text-right">{column} {level}</TableHead>) : <><TableHead className="text-right">n</TableHead><TableHead className="text-right">Mean ± SE · Group</TableHead></>}</TableRow></TableHeader>
        <TableBody>{rows.map(rowLevel => <TableRow key={rowLevel}><TableCell className="font-medium">{rowLevel}</TableCell>{columns.length ? columns.map(columnLevel => { const cell = normalized.find(m => String(m.factor_levels?.[row]) === rowLevel && String(m.factor_levels?.[column]) === columnLevel && (!facet || String(m.factor_levels?.[facet]) === facetLevel)); return <TableCell key={columnLevel} className="text-right whitespace-nowrap">{cell ? value(cell) : "—"}</TableCell>; }) : (() => { const cell = normalized.find(m => String(m.factor_levels?.[row]) === rowLevel); return <><TableCell className="text-right">{cell?.n ?? "—"}</TableCell><TableCell className="text-right whitespace-nowrap">{cell ? value(cell) : "—"}</TableCell></>; })()}</TableRow>)}</TableBody>
      </Table></div></div>)}
    <div className="space-y-1 text-xs text-muted-foreground"><p>Means sharing at least one letter are not significantly different at α = 0.05.</p>{scaleNote && <p>Tukey grouping is based on the declared inference variable ({scaleNote.inferenceColumn}); means are displayed on the biological/raw scale ({scaleNote.displayColumn}).</p>}</div>
  </div>;
}
