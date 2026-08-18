/**
 * Response mapping.
 *
 * Every response is declared in full: which column carries the biological value
 * the researcher reads, and which column the inference runs on. Those two are
 * never paired by guessing at similar column names — a "Mort48_pct" /
 * "AdtM48" relationship is only real because someone says it is.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { emptyDraft } from "./drafts";
import type { BioassayResponseType, ResponseDraft } from "@/types/cropProtection";

const RESPONSE_TYPES: { value: BioassayResponseType; label: string; hint: string }[] = [
  { value: "mortality", label: "Mortality", hint: "Percent mortality, 0–100. Supports Abbott correction." },
  { value: "count", label: "Count", hint: "Counts such as adult emergence. Non-negative." },
  { value: "continuous", label: "Continuous", hint: "Continuous measurements such as weight loss." },
];

interface Props {
  columns: string[];
  drafts: ResponseDraft[];
  onChange: (drafts: ResponseDraft[]) => void;
}

export function BioassayResponseMapping({ columns, drafts, onChange }: Props) {
  const update = (key: string, patch: Partial<ResponseDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Select responses</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add one entry per measured response. Each is analysed as its own factorial CRD.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {drafts.map((draft, index) => {
          const scalesDiffer =
            draft.rawColumn && draft.inferenceColumn && draft.rawColumn !== draft.inferenceColumn;
          return (
            <div key={draft.key} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Response {index + 1}</p>
                {drafts.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChange(drafts.filter((d) => d.key !== draft.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Response name</Label>
                  <Input
                    value={draft.id}
                    placeholder="e.g. Mortality 48 h"
                    onChange={(event) => update(draft.key, { id: event.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Biological type</Label>
                  <Select
                    value={draft.type}
                    onValueChange={(value) =>
                      update(draft.key, {
                        type: value as BioassayResponseType,
                        // Abbott is defined only against a mortality control.
                        abbottCorrection: value === "mortality" ? draft.abbottCorrection : false,
                        cumulative: value === "mortality" ? draft.cumulative : false,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESPONSE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {RESPONSE_TYPES.find((t) => t.value === draft.type)?.hint}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Raw / display column</Label>
                  <Select
                    value={draft.rawColumn || undefined}
                    onValueChange={(value) => update(draft.key, { rawColumn: value })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select column…" /></SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column} value={column}>{column}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The biological scale shown in means, plots and tables.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Inference column</Label>
                  <Select
                    value={draft.inferenceColumn || undefined}
                    onValueChange={(value) => update(draft.key, { inferenceColumn: value })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select column…" /></SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column} value={column}>{column}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The column ANOVA and Tukey run on. Choose the same column when no
                    transformation was applied.
                  </p>
                </div>

                {draft.type === "mortality" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Observation time</Label>
                      <Input
                        value={draft.observationTime}
                        placeholder="e.g. 48"
                        onChange={(event) =>
                          update(draft.key, { observationTime: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Time unit</Label>
                      <Input
                        value={draft.timeUnit}
                        placeholder="hours"
                        onChange={(event) => update(draft.key, { timeUnit: event.target.value })}
                      />
                    </div>
                  </>
                )}

                {draft.type !== "mortality" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        Observation time <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        value={draft.observationTime}
                        placeholder="e.g. 21"
                        onChange={(event) =>
                          update(draft.key, { observationTime: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        Time unit <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        value={draft.timeUnit}
                        placeholder="days"
                        onChange={(event) => update(draft.key, { timeUnit: event.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              {draft.type === "mortality" && (
                <div className="flex flex-wrap gap-5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.abbottCorrection}
                      onCheckedChange={(checked) =>
                        update(draft.key, { abbottCorrection: checked === true })
                      }
                    />
                    Abbott correction
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.cumulative}
                      onCheckedChange={(checked) =>
                        update(draft.key, { cumulative: checked === true })
                      }
                    />
                    Cumulative mortality
                  </label>
                </div>
              )}

              {scalesDiffer && (
                <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                  Inference: <span className="font-medium text-foreground">{draft.inferenceColumn}</span>
                  {" · "}
                  Display: <span className="font-medium text-foreground">{draft.rawColumn}</span>
                  {" — "}
                  ANOVA and Tukey will use the transformed values; reported means stay on the
                  biological scale.
                </p>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onChange([...drafts, emptyDraft(drafts.length)])}
        >
          <Plus className="h-4 w-4" />
          Add response
        </Button>
      </CardContent>
    </Card>
  );
}
