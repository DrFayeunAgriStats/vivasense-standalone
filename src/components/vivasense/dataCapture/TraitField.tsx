/**
 * Dynamic trait renderer — one field, driven entirely by its TraitDefinition.
 * Renders the correct control per trait_type and surfaces validation + autosave
 * state. Deliberately dumb: the parent owns values, validation, and persistence,
 * which keeps this the single clean seam a future AI layer can wrap to suggest
 * corrections or flag outliers (no AI implemented here).
 */
import { Loader2, Check, CloudOff, AlertCircle, MapPin, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { TraitDefinition, TraitValue } from "@/types/dataCapture";

export type FieldSaveState = "idle" | "saving" | "saved" | "queued" | "error";

interface Props {
  def: TraitDefinition;
  value: TraitValue;
  error: string | null;
  saveState: FieldSaveState;
  onChange: (value: TraitValue) => void;
  onEnterNext?: () => void;
  onCaptureGps?: () => void;
  onAddPhoto?: () => void;
}

function SaveIndicator({ state }: { state: FieldSaveState }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Saved</span>;
  if (state === "queued") return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><CloudOff className="h-3 w-3" /> Queued (offline)</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" /> Retry</span>;
  return null;
}

export function TraitField({ def, value, error, saveState, onChange, onEnterNext, onCaptureGps, onAddPhoto }: Props) {
  const numeric = def.trait_type === "numeric" || def.trait_type === "integer" || def.trait_type === "decimal";
  const invalid = !!error;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onEnterNext?.(); }
  };

  return (
    <div className="py-3 border-b border-border/60 last:border-0" data-trait-type={def.trait_type} data-trait-name={def.name}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <Label htmlFor={`trait-${def.id}`} className="text-sm">
          {def.label}
          {def.required && <span className="text-destructive"> *</span>}
          {def.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">({def.unit})</span>}
        </Label>
        <SaveIndicator state={saveState} />
      </div>

      {/* Numeric family */}
      {numeric && (
        <div className="flex items-center gap-2">
          <Input
            id={`trait-${def.id}`}
            type="number"
            inputMode={def.trait_type === "integer" ? "numeric" : "decimal"}
            step={def.trait_type === "integer" ? 1 : "any"}
            value={value == null ? "" : String(value)}
            aria-invalid={invalid}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
            onKeyDown={onKeyDown}
            className={`h-11 text-base ${invalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
            placeholder="—"
          />
          {def.unit && <span className="text-sm text-muted-foreground whitespace-nowrap">{def.unit}</span>}
        </div>
      )}

      {/* Dropdown as large touch-friendly radios */}
      {def.trait_type === "dropdown" && (
        <div className="flex flex-wrap gap-2">
          {(def.options ?? []).map((opt) => {
            const selected = String(value) === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(selected ? null : opt)}
                className={`min-w-11 h-11 px-4 rounded-md border text-sm transition-colors ${
                  selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:border-primary/40"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* Boolean */}
      {def.trait_type === "boolean" && (
        <div className="flex gap-2">
          {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => {
            const selected = value === v;
            return (
              <button
                key={l}
                type="button"
                onClick={() => onChange(selected ? null : v)}
                className={`flex-1 h-11 rounded-md border text-sm transition-colors ${
                  selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:border-primary/40"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* Text */}
      {def.trait_type === "text" && (
        <Textarea
          id={`trait-${def.id}`}
          rows={2}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="text-base"
          placeholder="—"
        />
      )}

      {/* Date */}
      {def.trait_type === "date" && (
        <Input
          id={`trait-${def.id}`}
          type="date"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="h-11 text-base"
        />
      )}

      {/* GPS trait */}
      {def.trait_type === "gps" && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={onCaptureGps}>
            <MapPin className="h-4 w-4 mr-1.5" /> Capture location
          </Button>
          <span className="text-sm text-muted-foreground">{value ? String(value) : "Not set"}</span>
        </div>
      )}

      {/* Photo trait */}
      {def.trait_type === "photo" && (
        <Button type="button" variant="outline" className="h-11" onClick={onAddPhoto}>
          <Camera className="h-4 w-4 mr-1.5" /> Add photo
        </Button>
      )}

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
