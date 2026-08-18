/**
 * Explicit role mapping for the bioassay design.
 *
 * Nothing is inferred as final truth: every role below is chosen by the
 * researcher. Replicate is stated as an experimental-unit identifier — there is
 * no Block selector, because a CRD declares no blocking structure.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";

export interface RoleMappingState {
  treatmentColumn: string;
  doseColumn: string;
  replicateColumn: string;
  controlLevel: string;
  doseSeriesText: string;
}

interface Props {
  columns: string[];
  /** Distinct values seen in the preview rows, offered as control-level hints. */
  controlSuggestions: string[];
  value: RoleMappingState;
  onChange: (next: RoleMappingState) => void;
}

function ColumnSelect({
  label, hint, value, onChange, options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select column…" /></SelectTrigger>
        <SelectContent>
          {options.map((column) => (
            <SelectItem key={column} value={column}>{column}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function BioassayRoleMapping({ columns, controlSuggestions, value, onChange }: Props) {
  const set = (patch: Partial<RoleMappingState>) => onChange({ ...value, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Map roles</CardTitle>
        <p className="text-sm text-muted-foreground">
          Declare what each column means in this experiment. Nothing is assigned
          automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColumnSelect
            label="Treatment column"
            hint="The products or treatments being compared."
            value={value.treatmentColumn}
            onChange={(v) => set({ treatmentColumn: v })}
            options={columns}
          />
          <ColumnSelect
            label="Dose / Concentration column"
            hint="Numeric applied dose or concentration."
            value={value.doseColumn}
            onChange={(v) => set({ doseColumn: v })}
            options={columns.filter((c) => c !== value.treatmentColumn)}
          />
          <ColumnSelect
            label="Replicate column"
            value={value.replicateColumn}
            onChange={(v) => set({ replicateColumn: v })}
            options={columns.filter(
              (c) => c !== value.treatmentColumn && c !== value.doseColumn
            )}
          />
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Control treatment level</Label>
            <Input
              list="bioassay-control-levels"
              value={value.controlLevel}
              placeholder="e.g. C"
              onChange={(event) => set({ controlLevel: event.target.value })}
            />
            <datalist id="bioassay-control-levels">
              {controlSuggestions.map((level) => (
                <option key={level} value={level} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              The untreated level, exactly as written in the Treatment column. It is excluded
              from the factorial analysis and used as the Abbott reference.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Replicate identifies independent experimental units in a CRD. It is not
            automatically treated as a block, and it never enters the ANOVA model as a source.
          </span>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Expected dose levels</Label>
          <Input
            value={value.doseSeriesText}
            placeholder="0.2, 0.4, 0.6, 0.8, 1.0"
            onChange={(event) => set({ doseSeriesText: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Confirm the dose series every treatment should carry, separated by commas. The
            analysis stops if a treatment is missing one of these levels or carries a dose
            outside the series — so this is a deliberate check, not a formality.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
