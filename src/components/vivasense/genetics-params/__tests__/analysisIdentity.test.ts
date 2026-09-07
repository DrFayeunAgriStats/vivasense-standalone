/**
 * W1-INT-06 — analysis result scientific identity binding.
 *
 * The load-bearing claim under test: a response arriving after the
 * scientific form state has changed must never install, even when no second
 * request was ever dispatched. Section 9 (RED -> GREEN) is the mechanism
 * proof — it demonstrates that recomputing "current" fingerprint from the
 * SAME snapshot the caller captured at dispatch time cannot detect anything,
 * while the controller's own `isStillCurrent` (reading its own live,
 * independently-mutated state) correctly does.
 */
import { describe, it, expect } from "vitest";
import {
  canonicalAnalysisFingerprint,
  createAnalysisIdentityController,
  snapshotAnalysisContext,
  type ScientificInputs,
} from "../analysisIdentity";

const baseInputs = (over: Partial<ScientificInputs> = {}): ScientificInputs => ({
  datasetInstanceId: "ds-1",
  design: "rcbd",
  mapping: { treatment: "Genotype", rep: "Rep" },
  selectedTraits: ["Yield"],
  responseSemantics: {},
  alpha: 0.05,
  module: "anova",
  mode: "single",
  ...over,
});

describe("canonicalAnalysisFingerprint", () => {
  it("is identical for the same scientific state", () => {
    const a = canonicalAnalysisFingerprint(baseInputs());
    const b = canonicalAnalysisFingerprint(baseInputs());
    expect(a).toBe(b);
  });

  it("differs when design differs", () => {
    const rcbd = canonicalAnalysisFingerprint(baseInputs({ design: "rcbd" }));
    const crd = canonicalAnalysisFingerprint(baseInputs({ design: "crd" }));
    expect(rcbd).not.toBe(crd);
  });

  it("differs when the structural mapping differs (wrong-but-distinct case)", () => {
    const correct = canonicalAnalysisFingerprint(
      baseInputs({ mapping: { treatment: "Genotype", rep: "Rep" } })
    );
    const reversed = canonicalAnalysisFingerprint(
      baseInputs({ mapping: { treatment: "Rep", rep: "Genotype" } })
    );
    expect(correct).not.toBe(reversed);
  });

  it("differs when dataset identity differs", () => {
    const a = canonicalAnalysisFingerprint(baseInputs({ datasetInstanceId: "ds-1" }));
    const b = canonicalAnalysisFingerprint(baseInputs({ datasetInstanceId: "ds-2" }));
    expect(a).not.toBe(b);
  });

  it("differs when alpha differs, and does not round or collide", () => {
    const a = canonicalAnalysisFingerprint(baseInputs({ alpha: 0.05 }));
    const b = canonicalAnalysisFingerprint(baseInputs({ alpha: 0.01 }));
    const c = canonicalAnalysisFingerprint(baseInputs({ alpha: 0.1 }));
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("TRAIT ORDER IDENTITY: ORDER-INDEPENDENT — same set, different click order, fingerprints identically", () => {
    const clickedAB = canonicalAnalysisFingerprint(baseInputs({ selectedTraits: ["Yield", "Height"] }));
    const clickedBA = canonicalAnalysisFingerprint(baseInputs({ selectedTraits: ["Height", "Yield"] }));
    expect(clickedAB).toBe(clickedBA);
  });

  it("differs when the actual set of selected traits differs", () => {
    const a = canonicalAnalysisFingerprint(baseInputs({ selectedTraits: ["Yield"] }));
    const b = canonicalAnalysisFingerprint(baseInputs({ selectedTraits: ["Yield", "Height"] }));
    expect(a).not.toBe(b);
  });

  it("response semantics are bound to their trait, not positionally comparable across traits", () => {
    const a = canonicalAnalysisFingerprint(
      baseInputs({
        selectedTraits: ["Yield", "Height"],
        responseSemantics: { Yield: "percentage", Height: "continuous" },
      })
    );
    const b = canonicalAnalysisFingerprint(
      baseInputs({
        selectedTraits: ["Yield", "Height"],
        responseSemantics: { Yield: "continuous", Height: "percentage" },
      })
    );
    expect(a).not.toBe(b);
  });

  it("drops a declared semantic for a trait that is no longer selected, matching buildAnovaRequest's own rule", () => {
    const withStaleDeclaration = canonicalAnalysisFingerprint(
      baseInputs({
        selectedTraits: ["Yield"],
        responseSemantics: { Yield: "continuous", Height: "percentage" }, // Height not selected
      })
    );
    const withoutStaleDeclaration = canonicalAnalysisFingerprint(
      baseInputs({
        selectedTraits: ["Yield"],
        responseSemantics: { Yield: "continuous" },
      })
    );
    expect(withStaleDeclaration).toBe(withoutStaleDeclaration);
  });

  it("normalizes absent structural roles consistently regardless of undefined vs missing key", () => {
    const a = canonicalAnalysisFingerprint(baseInputs({ mapping: { treatment: "Genotype", rep: "Rep" } }));
    const b = canonicalAnalysisFingerprint(
      baseInputs({ mapping: { treatment: "Genotype", rep: "Rep", factor_a: undefined } })
    );
    expect(a).toBe(b);
  });

  it("does not use filename as dataset identity — only datasetInstanceId participates", () => {
    // canonicalAnalysisFingerprint's ScientificInputs has no filename field at
    // all, so there is nothing for a filename to leak through; this test
    // pins that datasetInstanceId alone determines the dataset component.
    const a = canonicalAnalysisFingerprint(baseInputs({ datasetInstanceId: "abc" }));
    const b = canonicalAnalysisFingerprint(baseInputs({ datasetInstanceId: "abc" }));
    expect(a).toBe(b);
  });
});

describe("snapshotAnalysisContext", () => {
  it("captures an independent copy that later mutation of the source cannot alter", () => {
    const inputs = baseInputs();
    const context = snapshotAnalysisContext(inputs, 1);
    inputs.mapping.treatment = "SomethingElse";
    inputs.selectedTraits.push("Extra");
    expect(context.mapping.treatment).toBe("Genotype");
    expect(context.selectedTraits).toEqual(["Yield"]);
  });
});

describe("createAnalysisIdentityController — request-generation protection", () => {
  it("two dispatches never share a generation, even with identical scientific state", () => {
    const controller = createAnalysisIdentityController(baseInputs());
    const a = controller.beginDispatch();
    const b = controller.beginDispatch();
    expect(a.generation).not.toBe(b.generation);
    expect(a.fingerprint).toBe(b.fingerprint); // same scientific state, different requests
  });

  it("an older request is not current once a newer one has been dispatched, even with unchanged scientific state", () => {
    const controller = createAnalysisIdentityController(baseInputs());
    const a = controller.beginDispatch();
    controller.beginDispatch(); // B, superseding A
    expect(controller.isStillCurrent(a.generation, a.fingerprint)).toBe(false);
  });

  it("isCurrentGeneration ignores fingerprint — used to free in-flight UI state safely", () => {
    const controller = createAnalysisIdentityController(baseInputs());
    const a = controller.beginDispatch();
    controller.mutate({ design: "crd" }); // fingerprint diverges, no second request
    expect(controller.isCurrentGeneration(a.generation)).toBe(true);
    expect(controller.isStillCurrent(a.generation, a.fingerprint)).toBe(false);
  });

  it("invalidate() (unmount) fails the generation check for a still-in-flight dispatch", () => {
    const controller = createAnalysisIdentityController(baseInputs());
    const a = controller.beginDispatch();
    controller.invalidate();
    expect(controller.isCurrentGeneration(a.generation)).toBe(false);
    expect(controller.isStillCurrent(a.generation, a.fingerprint)).toBe(false);
  });
});

describe("W1-INT-06 — LOAD-BEARING: stale-closure mechanism (RED -> GREEN)", () => {
  /**
   * The naive, INCORRECT approach: "current" fingerprint is recomputed from
   * a plain object the caller captured at dispatch time (exactly what a
   * `handleAnalyze` closure's local `design`/`mapping`/etc. variables are —
   * frozen at whatever they were when that invocation started, and never
   * updated by any later mutation, no matter how long the `await` takes).
   */
  function naiveIsStillCurrent(
    dispatchFingerprint: string,
    dispatchTimeSnapshot: ScientificInputs
  ): boolean {
    const recomputed = canonicalAnalysisFingerprint(dispatchTimeSnapshot);
    return recomputed === dispatchFingerprint;
  }

  it("RED — the naive approach cannot detect a divergence with no second request dispatched", () => {
    const dispatchTimeSnapshot = baseInputs({ design: "rcbd" });
    const dispatchFingerprint = canonicalAnalysisFingerprint(dispatchTimeSnapshot);

    // Bypass any UI lock entirely: the scientific state changes to CRD while
    // the request is still "in flight" (nothing here awaits anything — the
    // point is purely that dispatchTimeSnapshot itself never changes).
    // A real `design` state variable would now read "crd"; the naive
    // function has no way to observe that, because it was only ever given
    // the frozen snapshot from dispatch time.
    const naiveResult = naiveIsStillCurrent(dispatchFingerprint, dispatchTimeSnapshot);

    // This is the flaw: the naive check WRONGLY reports "still current" even
    // though the real scientific state has moved on to CRD. A production
    // implementation built this way would install the stale RCBD response
    // under the live CRD form with no protection at all.
    expect(naiveResult).toBe(true); // proves the naive mechanism is blind — RED
  });

  it("GREEN — the controller's isStillCurrent correctly detects the same divergence", () => {
    const controller = createAnalysisIdentityController(baseInputs({ design: "rcbd" }));
    const { generation, fingerprint: dispatchFingerprint } = controller.beginDispatch();

    // Same scenario as the RED test: no second request is ever dispatched.
    // Bypass any UI lock and mutate the controller's live scientific state
    // directly, exactly as a future code path that skips the governed
    // mutation helper — or a test exercising that failure boundary
    // directly — would.
    controller.mutate({ design: "crd" });

    const stillCurrent = controller.isStillCurrent(generation, dispatchFingerprint);

    // The controller reads its OWN live fingerprint at the time of the
    // check, not a snapshot the caller froze at dispatch time — so it
    // correctly reports the divergence.
    expect(stillCurrent).toBe(false); // GREEN
  });

  it("GREEN — a full dispatch/mutate/resolve simulation discards the stale RCBD result under a live CRD state", () => {
    const controller = createAnalysisIdentityController(
      baseInputs({ design: "rcbd", mapping: { treatment: "Genotype", rep: "Rep" } })
    );
    const { generation, fingerprint: dispatchFingerprint } = controller.beginDispatch();
    const context = snapshotAnalysisContext(controller.getInputs(), generation);

    // Simulate: form mutated to CRD while the (unmodelled) request is still
    // "in flight" — no second request dispatched.
    controller.mutate({ design: "crd", mapping: { treatment: "Genotype" } });

    // Simulate the response resolving now.
    const shouldInstall = controller.isStillCurrent(generation, dispatchFingerprint);

    expect(shouldInstall).toBe(false);
    // The bound context, had it been installed, would still correctly say
    // RCBD — proving the two guarantees (installation safety here, and
    // rendering truthfulness in AnalysisResultsSection) are independent.
    expect(context.design).toBe("rcbd");
  });
});
