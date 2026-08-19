import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Plus, Trash2 } from "lucide-react";
import type { BioassayFactorRole } from "@/types/cropProtection";

export interface FactorMappingState { id: string; column: string; displayName: string; semanticRole: BioassayFactorRole | ""; }
export interface RoleMappingState { factors: FactorMappingState[]; replicateColumn: string; controlLevel: string; doseSeriesText: string; }
interface Props { columns: string[]; controlSuggestions: string[]; value: RoleMappingState; onChange: (next: RoleMappingState) => void; }
const ROLES: { value: BioassayFactorRole; label: string }[] = [
  { value: "treatment", label: "Treatment" }, { value: "dose", label: "Dose" },
  { value: "formulation", label: "Formulation" }, { value: "variety", label: "Variety" },
  { value: "level", label: "Level" }, { value: "other", label: "Other" },
];

function ColumnSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value || undefined} onValueChange={onChange}>
    <SelectTrigger><SelectValue placeholder="Select column…" /></SelectTrigger><SelectContent>{options.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
  </Select></div>;
}

export function BioassayRoleMapping({ columns, controlSuggestions, value, onChange }: Props) {
  const updateFactor = (index: number, patch: Partial<FactorMappingState>) => onChange({ ...value, factors: value.factors.map((factor, i) => i === index ? { ...factor, ...patch } : factor) });
  const doseFactor = value.factors.find(f => f.semanticRole === "dose");
  const addFactor = () => value.factors.length < 3 && onChange({ ...value, factors: [...value.factors, { id: `factor_${value.factors.length + 1}`, column: "", displayName: "", semanticRole: "" }] });
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Experimental Factors</CardTitle><p className="text-sm text-muted-foreground">Map one to three variables deliberately varied in the experiment.</p></CardHeader>
    <CardContent className="space-y-5">
      {value.factors.map((factor, index) => <div key={factor.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <ColumnSelect label={`Factor ${index + 1} column`} value={factor.column} onChange={column => updateFactor(index, { column })} options={columns.filter(c => c === factor.column || !value.factors.some(f => f.column === c))} />
        <div className="space-y-1.5"><Label>Display label</Label><Input value={factor.displayName} placeholder={factor.column || "e.g. Variety"} onChange={e => updateFactor(index, { displayName: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Semantic role (optional)</Label><Select value={factor.semanticRole || "none"} onValueChange={role => updateFactor(index, { semanticRole: role === "none" ? "" : role as BioassayFactorRole })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{ROLES.map(role => <SelectItem key={role.value} value={role.value} disabled={role.value === "dose" && !!doseFactor && doseFactor.id !== factor.id}>{role.label}</SelectItem>)}</SelectContent></Select></div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove Factor ${index + 1}`} disabled={value.factors.length === 1} onClick={() => onChange({ ...value, factors: value.factors.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      <Button type="button" variant="outline" className="gap-2" onClick={addFactor} disabled={value.factors.length >= 3}><Plus className="h-4 w-4" /> Add Factor</Button>
      {value.factors.length >= 3 && <p className="text-xs text-muted-foreground">VivaSense Crop Protection currently supports up to three factorial experimental factors in CRD. More complex designs will be added after validation.</p>}
      <ColumnSelect label="Replicate column" value={value.replicateColumn} onChange={replicateColumn => onChange({ ...value, replicateColumn })} options={columns.filter(c => !value.factors.some(f => f.column === c))} />
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Experimental factors are variables deliberately varied in the experiment, such as treatment, dose, variety, formulation or level. Replicate identifies repeated experimental units and is not itself an experimental factor.</span></div>
      <div className="space-y-1.5"><Label>Control level (optional)</Label><Input list="bioassay-control-levels" value={value.controlLevel} placeholder="Leave blank when there is no standalone control" onChange={e => onChange({ ...value, controlLevel: e.target.value })} /><datalist id="bioassay-control-levels">{controlSuggestions.map(level => <option key={level} value={level} />)}</datalist></div>
      {doseFactor && <div className="space-y-1.5"><Label>Expected dose levels</Label><Input value={value.doseSeriesText} placeholder="0.2, 0.4, 0.6, 0.8" onChange={e => onChange({ ...value, doseSeriesText: e.target.value })} /><p className="text-xs text-muted-foreground">Optional comma-separated completeness check for the explicitly mapped dose factor.</p></div>}
    </CardContent></Card>;
}
