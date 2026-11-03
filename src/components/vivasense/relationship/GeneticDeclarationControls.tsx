import {
  GENETIC_DECLARATION_TEXT,
  GENETIC_DESIGN_OPTIONS,
  type GeneticControlsState,
} from "@/lib/relationshipGeneticContract";

interface Props {
  value: GeneticControlsState;
  onChange: (next: GeneticControlsState) => void;
  idPrefix?: string;
}

/**
 * REL-OPEN-01 A1 + A1b — the two mandatory, never-preselected controls for
 * genetically interpreted relationship statistics. Rendered ONLY in the
 * Breeding & Genetic context; General correlation never shows them.
 */
export function GeneticDeclarationControls({ value, onChange, idPrefix = "genetic" }: Props) {
  const declId = `${idPrefix}-declaration`;
  const designId = `${idPrefix}-design`;
  const unavailable = GENETIC_DESIGN_OPTIONS.filter((o) => !o.executable);
  return (
    <div className="space-y-4" data-testid="genetic-declaration-controls">
      <div className="rounded-lg border border-border p-4">
        <label htmlFor={declId} className="flex items-start gap-3 text-sm">
          <input
            id={declId}
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={value.declarationChecked}
            onChange={(e) => onChange({ ...value, declarationChecked: e.target.checked })}
          />
          <span>{GENETIC_DECLARATION_TEXT} *</span>
        </label>
      </div>

      <div className="rounded-lg border border-border p-4">
        <label htmlFor={designId} className="block text-sm font-medium">
          Experimental design *
        </label>
        <select
          id={designId}
          className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm"
          value={value.design}
          onChange={(e) =>
            onChange({ ...value, design: e.target.value === "rcbd" ? "rcbd" : "" })
          }
        >
          <option value="">Select the trial design…</option>
          {GENETIC_DESIGN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} disabled={!o.executable}>
              {o.executable ? o.label : `${o.label} — not available`}
            </option>
          ))}
        </select>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {unavailable.map((o) => (
            <li key={o.value}>
              {o.label}: {o.reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
