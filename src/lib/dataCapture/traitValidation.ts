/**
 * Data Capture — client-side trait validation & coercion (pure).
 *
 * Drives immediate field-level validation in the plot entry form. The same
 * TraitDefinition metadata (type, bounds, allow_negative, required) is what a
 * future AI layer can reuse to flag outliers — no AI here, just the structure.
 */
import type { TraitDefinition, TraitValue } from "@/types/dataCapture";

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

const NUMERIC_TYPES = new Set(["numeric", "integer", "decimal"]);

/** True when a value counts as "empty" (nothing entered). */
export function isEmpty(value: TraitValue): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Convert raw input into the stored value for a trait type. Returns null when
 * the input is blank. Numeric inputs that aren't parseable stay as the raw
 * string so validation can flag them.
 */
export function coerceValue(def: TraitDefinition, raw: string | boolean | null): TraitValue {
  if (raw === null || raw === "") return null;
  if (def.trait_type === "boolean") return typeof raw === "boolean" ? raw : raw === "true";
  if (NUMERIC_TYPES.has(def.trait_type)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : (raw as string); // keep bad input for validation
  }
  return raw as string; // text, dropdown, date
}

/** Validate a coerced value against its definition. */
export function validateTrait(def: TraitDefinition, value: TraitValue): ValidationResult {
  const ok: ValidationResult = { valid: true, error: null };
  const fail = (error: string): ValidationResult => ({ valid: false, error });

  if (isEmpty(value)) {
    return def.required ? fail(`${def.label} is required.`) : ok;
  }

  if (NUMERIC_TYPES.has(def.trait_type)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fail(`${def.label} must be a number.`);
    }
    if (def.trait_type === "integer" && !Number.isInteger(value)) {
      return fail(`${def.label} must be a whole number.`);
    }
    if (!def.allow_negative && value < 0) {
      return fail(`${def.label} cannot be negative.`);
    }
    if (def.min_value != null && value < def.min_value) {
      return fail(`${def.label} must be ≥ ${def.min_value}.`);
    }
    if (def.max_value != null && value > def.max_value) {
      return fail(`${def.label} must be ≤ ${def.max_value}.`);
    }
    return ok;
  }

  if (def.trait_type === "dropdown") {
    const opts = def.options ?? [];
    if (opts.length > 0 && !opts.includes(String(value))) {
      return fail(`${def.label}: choose a valid option.`);
    }
    return ok;
  }

  if (def.trait_type === "date") {
    if (isNaN(new Date(String(value)).getTime())) return fail(`${def.label} must be a valid date.`);
    return ok;
  }

  return ok;
}

/** True when every required trait has a valid value — used to mark a plot complete. */
export function isPlotComplete(defs: TraitDefinition[], values: Record<string, TraitValue>): boolean {
  return defs.every((d) => {
    const r = validateTrait(d, values[d.id] ?? null);
    if (!r.valid) return false;
    if (d.required && isEmpty(values[d.id] ?? null)) return false;
    return true;
  });
}
