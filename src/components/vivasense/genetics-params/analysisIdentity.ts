/**
 * W1-INT-06 — Analysis result scientific identity binding.
 *
 * A researcher-facing analysis result must remain inseparably bound to the
 * exact scientific input state that generated it. Live mutable form state
 * must never reinterpret an already-computed result.
 *
 * `AnovaModulePanel` renders `design`, the structural column mapping, the
 * selected traits, their declared response semantics, and alpha as plain
 * `useState` values that change on every researcher interaction. Prior to
 * this module, a result was installed with `setResults(res)` alone — nothing
 * recorded which of those live values were true when `res` was requested, so
 * a result computed under one scientific state could be (and, reproduced
 * live, was) rendered and labelled using whatever the form had since become.
 *
 * `createAnalysisIdentityController` is deliberately framework-agnostic: it
 * is a plain closure over mutable state, not a React hook, so the mechanism
 * itself — dispatch-time snapshot vs. live current state — can be exercised
 * and proven directly in a unit test, independent of any component render,
 * DOM, or async timing.
 */

import type { AnovaAlpha, ResponseSemantic } from "@/services/geneticsUploadApi";
import { activeMapping, type ColumnMapping, type GovernedDesignType } from "./anovaDesigns";

/** Every value capable of changing model structure, numerical output,
 * inferential conclusion, transformation decision, interpretation, or report
 * content. Presentation-only state (e.g. `transformChoice`, which toggles
 * which already-computed branch of an existing result to display) is
 * deliberately excluded. */
export interface ScientificInputs {
  /** W1-INT-09 — current-session dataset-instance identity, NOT the backend
   * operational datasetToken (see lib/datasetInstanceIdentity.ts). A
   * `datasetToken` of `null`/`undefined` is a legitimate backend fallback and
   * must never be mistaken for "the dataset didn't change" — this field is
   * always a caller-supplied, non-empty identity independent of it. */
  datasetInstanceId: string;
  design: GovernedDesignType;
  mapping: ColumnMapping;
  selectedTraits: string[];
  responseSemantics: Record<string, ResponseSemantic>;
  alpha: AnovaAlpha;
  module: string;
  mode: "single" | "multi";
}

/** Immutable snapshot of the scientific inputs at the moment a request was
 * dispatched, plus the identity fields needed to recognise it later. */
export interface AnalysisContext extends ScientificInputs {
  requestId: number;
  dispatchedAt: number;
}

/** A backend response bound, permanently, to the context that produced it. */
export interface AnalysisResult<TResponse> {
  response: TResponse;
  context: AnalysisContext;
}

function cloneScientificInputs(inputs: ScientificInputs): ScientificInputs {
  return {
    datasetInstanceId: inputs.datasetInstanceId,
    design: inputs.design,
    mapping: { ...inputs.mapping },
    selectedTraits: [...inputs.selectedTraits],
    responseSemantics: { ...inputs.responseSemantics },
    alpha: inputs.alpha,
    module: inputs.module,
    mode: inputs.mode,
  };
}

/**
 * Canonical, deterministic fingerprint of a scientific-inputs snapshot.
 *
 * Every field occupies a fixed array position, so `JSON.stringify` on this
 * controlled, fixed-shape array is safe — unlike `JSON.stringify` on an
 * uncontrolled object, whose key order is not guaranteed stable across
 * construction sites. Researcher-supplied strings (column names, trait
 * names) pass through JSON's own string escaping unmodified; nothing here
 * joins them with a delimiter that could collide with their content.
 *
 * Trait order is deliberately normalised (sorted) before fingerprinting:
 * `selectedTraits`'s order reflects only the sequence traits were clicked in
 * (`AnovaModulePanel.toggleTrait` appends via `[...prev, t]`), which carries
 * no scientific meaning — the same *set* of traits, selected in a different
 * order, is the same analysis request. Alpha is stored as the raw literal
 * from the closed `AnovaAlpha` union (0.01 | 0.05 | 0.1); no rounding is
 * applied or needed, since the type system already forecloses any other
 * value from reaching this pathway.
 */
export function canonicalAnalysisFingerprint(inputs: ScientificInputs): string {
  const active = activeMapping(inputs.design, inputs.mapping);
  const structuralMapping: [string, string, string, string, string, string] = [
    active.treatment ?? "",
    active.rep ?? "",
    active.factor_a ?? "",
    active.factor_b ?? "",
    active.main_plot ?? "",
    active.sub_plot ?? "",
  ];

  const sortedTraits = [...inputs.selectedTraits].sort();
  const traitSet = new Set(sortedTraits);
  const semanticEntries: [string, ResponseSemantic][] = Object.entries(inputs.responseSemantics)
    .filter(([trait]) => traitSet.has(trait))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const canonical = [
    inputs.datasetInstanceId,
    inputs.design,
    structuralMapping,
    sortedTraits,
    semanticEntries,
    inputs.alpha,
    inputs.module,
    inputs.mode,
  ];
  return JSON.stringify(canonical);
}

export interface AnalysisIdentityController {
  /** The live scientific inputs, as of the most recent `mutate` call. */
  getInputs(): ScientificInputs;
  /** The live canonical fingerprint, as of the most recent `mutate` call. */
  getFingerprint(): string;
  /**
   * Apply a change to one or more scientific inputs. Must be the *only* path
   * by which any of these fields change — every onChange/onClick handler in
   * `AnovaModulePanel` that touches design, a structural role, alpha, trait
   * selection, response semantics, or dataset identity routes through this.
   */
  mutate(patch: Partial<ScientificInputs>): void;
  /**
   * Call synchronously, before dispatching a request. Returns the identity
   * pair to compare against later. `generation` increments on every call —
   * two requests dispatched in sequence never share a generation, even if
   * their scientific fingerprint happens to be identical.
   */
  beginDispatch(): { generation: number; fingerprint: string };
  /**
   * Call after an awaited response resolves. `true` only if BOTH no newer
   * request has been dispatched AND no scientific input has changed since
   * dispatch — the two are independent failure classes (request-vs-request
   * races, and a single request whose form diverged with no second request
   * ever sent) and both must hold.
   *
   * Reads live controller state directly — never a value captured by the
   * caller's own closure — so this remains correct no matter how stale the
   * caller's surrounding closure is. This is the fix for the specific
   * defect class where recomputing "current" from the same local variables
   * a `handleAnalyze` invocation captured at dispatch time trivially
   * matches itself and detects nothing.
   */
  isStillCurrent(generation: number, fingerprint: string): boolean;
  /**
   * `true` only if no newer request has been dispatched since `generation`.
   * Unlike `isStillCurrent`, this ignores the scientific fingerprint — it
   * answers "is some other, newer `handleAnalyze` invocation now
   * responsible for this component's in-flight state", not "did the
   * response install". A caller's `finally` block should reset shared
   * in-flight UI state (e.g. a spinner) whenever this is true, even when
   * `isStillCurrent` is false because the fingerprint alone diverged with no
   * second request ever dispatched — otherwise that UI state would remain
   * stuck, since no other invocation exists to reset it.
   */
  isCurrentGeneration(generation: number): boolean;
  /** Invalidate any in-flight request's identity without changing the
   * scientific fingerprint itself — used on unmount, so a response that
   * resolves afterward fails `isStillCurrent` even if, hypothetically,
   * nothing else about the scientific state ever changed. */
  invalidate(): void;
}

export function createAnalysisIdentityController(
  initial: ScientificInputs
): AnalysisIdentityController {
  let inputs = cloneScientificInputs(initial);
  let fingerprint = canonicalAnalysisFingerprint(inputs);
  let generation = 0;

  return {
    getInputs: () => inputs,
    getFingerprint: () => fingerprint,
    mutate(patch) {
      inputs = { ...inputs, ...patch };
      fingerprint = canonicalAnalysisFingerprint(inputs);
    },
    beginDispatch() {
      generation += 1;
      return { generation, fingerprint };
    },
    isStillCurrent(dispatchGeneration, dispatchFingerprint) {
      return dispatchGeneration === generation && dispatchFingerprint === fingerprint;
    },
    isCurrentGeneration(dispatchGeneration) {
      return dispatchGeneration === generation;
    },
    invalidate() {
      generation += 1;
    },
  };
}

/** Build the immutable dispatch-time context from a controller's current
 * (just-mutated-for-dispatch) inputs. Call synchronously, immediately after
 * `beginDispatch()`, before any `await`. */
export function snapshotAnalysisContext(
  inputs: ScientificInputs,
  requestId: number
): AnalysisContext {
  return {
    ...cloneScientificInputs(inputs),
    requestId,
    dispatchedAt: Date.now(),
  };
}
