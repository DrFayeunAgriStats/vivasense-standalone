/**
 * W1-UI-02 — post-run disclosure for unrecommendable transformation states.
 *
 * `triggered === false` does not mean "nothing scientifically relevant
 * happened". These pin that the three unrecommendable states are surfaced after
 * a run, per trait, compactly, and that the clean and evaluated cases are not
 * dragged in with them.
 */

import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  UnrecommendableStateNotice,
  describeUnrecommendableState,
  UNRECOMMENDABLE_STATES,
  type UnrecommendableTrait,
} from "../AnovaModulePanel";

afterEach(cleanup);

const item = (over: Partial<UnrecommendableTrait> = {}): UnrecommendableTrait => ({
  trait: "DTF_Days", state: "scale_unknown", shapiroP: 0.002, leveneP: 0.01, ...over,
});

describe("A / B / C — each unrecommendable state is disclosed after the run", () => {
  it("governs from recommendation_state, covering exactly the three states", () => {
    expect([...UNRECOMMENDABLE_STATES]).toEqual([
      "scale_unknown", "unsupported_scale", "declared_scale_mismatch",
    ]);
  });

  it("A — scale_unknown names the unspecified scale and makes no recommendation", () => {
    render(<UnrecommendableStateNotice items={[item({ state: "scale_unknown" })]} />);
    const text = screen.getByTestId("unrecommendable-DTF_Days").textContent ?? "";
    expect(text).toMatch(/response scale was not specified/i);
    expect(text).toMatch(/no automatic transformation was recommended/i);
  });

  it("B — unsupported_scale says the scale is known but has no governed pathway", () => {
    render(<UnrecommendableStateNotice items={[item({ state: "unsupported_scale" })]} />);
    const text = screen.getByTestId("unrecommendable-DTF_Days").textContent ?? "";
    expect(text).toMatch(/response scale is known/i);
    expect(text).toMatch(/no governed automatic transformation/i);
    expect(text).toMatch(/no substitute was chosen/i);
  });

  it("C — declared_scale_mismatch reports the conflict and no silent rewrite", () => {
    render(<UnrecommendableStateNotice items={[item({ state: "declared_scale_mismatch" })]} />);
    const text = screen.getByTestId("unrecommendable-DTF_Days").textContent ?? "";
    expect(text).toMatch(/conflicts with the observed data/i);
    expect(text).toMatch(/no scale-dependent transformation was applied/i);
    expect(text).toMatch(/declared type was not rewritten/i);
  });

  it("shows the raw diagnostics alongside each disclosure", () => {
    render(<UnrecommendableStateNotice items={[item({ shapiroP: 0.0004, leveneP: 0.031 })]} />);
    const text = screen.getByTestId("unrecommendable-DTF_Days").textContent ?? "";
    expect(text).toMatch(/Shapiro-Wilk p = <0\.001/);
    expect(text).toMatch(/Levene p = 0\.031/);
  });

  it("never claims assumptions were met, and never demands a transformation", () => {
    for (const state of UNRECOMMENDABLE_STATES) {
      cleanup();
      render(<UnrecommendableStateNotice items={[item({ state })]} />);
      const all = screen.getByTestId("unrecommendable-states").textContent ?? "";
      expect(all).not.toMatch(/assumptions (were )?(met|satisfied)/i);
      expect(all).toMatch(/do not by themselves mean that a transformation is required/i);
      expect(all).toMatch(/remains the result of record/i);
      expect(all).not.toMatch(/\bmust\b|(?<!transformation is )\brequired\b/i);
      // W1-UI-03: declared_scale_mismatch is reachable with clean diagnostics,
      // so the shared footer must never claim a diagnostic test was significant.
      expect(all.toLowerCase()).not.toMatch(/significant diagnostic/);
    }
  });

  it("is not alarmist — no alert role and no error styling hook", () => {
    const { container } = render(<UnrecommendableStateNotice items={[item()]} />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/destructive|text-red|bg-red/);
  });
});

describe("D / E — clean and evaluated runs are untouched", () => {
  it("D — not_required renders nothing at all", () => {
    const { container } = render(<UnrecommendableStateNotice items={[]} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("unrecommendable-states")).toBeNull();
  });

  it("D — not_required is not one of the disclosed states", () => {
    expect((UNRECOMMENDABLE_STATES as readonly string[])).not.toContain("not_required");
  });

  it("E — evaluated is not one of the disclosed states (the existing banner owns it)", () => {
    expect((UNRECOMMENDABLE_STATES as readonly string[])).not.toContain("evaluated");
  });
});

describe("H — multiple traits stay compact and per-trait", () => {
  it("discloses only affected traits, one line each", () => {
    render(
      <UnrecommendableStateNotice
        items={[
          item({ trait: "DTF_Days", state: "scale_unknown" }),
          item({ trait: "Pod_Count", state: "unsupported_scale" }),
        ]}
      />
    );
    // 4 traits selected, 2 unrecommendable -> exactly 2 disclosures.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByTestId("unrecommendable-DTF_Days")).toBeInTheDocument();
    expect(screen.getByTestId("unrecommendable-Pod_Count")).toBeInTheDocument();
    expect(screen.queryByTestId("unrecommendable-PHTF_cm")).toBeNull();
    expect(screen.queryByTestId("unrecommendable-Germination_pct")).toBeNull();
  });

  it("states the shared boilerplate once, not once per trait", () => {
    render(
      <UnrecommendableStateNotice
        items={["A", "B", "C", "D"].map((t) => item({ trait: t }))}
      />
    );
    const all = screen.getByTestId("unrecommendable-states").textContent ?? "";
    const occurrences = all.match(/do not by themselves mean that a transformation is required/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    // One container, not one panel per trait.
    expect(screen.getAllByTestId("unrecommendable-states")).toHaveLength(1);
  });

  it("each trait carries its own state and its own diagnostics", () => {
    render(
      <UnrecommendableStateNotice
        items={[
          item({ trait: "T1", state: "scale_unknown", shapiroP: 0.002, leveneP: 0.5 }),
          item({ trait: "T2", state: "declared_scale_mismatch", shapiroP: 0.04, leveneP: 0.006 }),
        ]}
      />
    );
    expect(screen.getByTestId("unrecommendable-T1").textContent).toMatch(/not specified/i);
    expect(screen.getByTestId("unrecommendable-T1").textContent).toMatch(/Levene p = 0\.500/);
    expect(screen.getByTestId("unrecommendable-T2").textContent).toMatch(/conflicts/i);
    expect(screen.getByTestId("unrecommendable-T2").textContent).toMatch(/Levene p = 0\.006/);
  });

  it("handles absent diagnostics without inventing numbers", () => {
    render(<UnrecommendableStateNotice items={[item({ shapiroP: null, leveneP: undefined })]} />);
    const text = screen.getByTestId("unrecommendable-DTF_Days").textContent ?? "";
    expect(text).toMatch(/Shapiro-Wilk p = —/);
    expect(text).toMatch(/Levene p = —/);
  });
});

describe("state descriptions are distinct", () => {
  it("no two states share wording", () => {
    const texts = UNRECOMMENDABLE_STATES.map(describeUnrecommendableState);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("none of them mention a scale the analysis was not told", () => {
    expect(describeUnrecommendableState("scale_unknown").toLowerCase()).not.toContain("percentage");
    expect(describeUnrecommendableState("scale_unknown").toLowerCase()).not.toContain("proportion");
    expect(describeUnrecommendableState("unsupported_scale").toLowerCase()).not.toContain("arcsine");
  });
});

/**
 * W1-UI-03 — the shared footer is state-neutral.
 *
 * W1-INT-04A2 made declared_scale_mismatch reachable with CLEAN diagnostics
 * (assumptions_met == true), on top of the concerning-diagnostics path it
 * already had. UnrecommendableTrait carries no assumptions_met field at all --
 * confirmed by the interface itself -- because `items` can mix independent
 * trait states (e.g. scale_unknown alongside declared_scale_mismatch) with
 * different underlying diagnostic outcomes, and no single boolean represents
 * that mixed container. The footer must therefore make no diagnostic-outcome
 * claim whatsoever, so it is true for every state, every diagnostic outcome,
 * and every mixture of the two.
 */
describe("W1-UI-03 — shared footer makes no diagnostic-outcome claim", () => {
  const CLEAN_P = { shapiroP: 0.736, leveneP: 0.983 };
  const CONCERNING_P = { shapiroP: 0.006, leveneP: 0.994 };

  // ── A. declared_scale_mismatch + clean diagnostics ─────────────────────

  it("A — mismatch row with clean diagnostics: state-neutral footer, no significance claim", () => {
    render(
      <UnrecommendableStateNotice
        items={[item({ trait: "Response_value", state: "declared_scale_mismatch", ...CLEAN_P })]}
      />
    );
    const row = screen.getByTestId("unrecommendable-Response_value").textContent ?? "";
    expect(row).toMatch(/conflicts with the observed data/i);
    expect(row).toMatch(/Shapiro-Wilk p = 0\.736/);
    expect(row).toMatch(/Levene p = 0\.983/);

    const all = screen.getByTestId("unrecommendable-states").textContent ?? "";
    expect(all.toLowerCase()).not.toMatch(/significant diagnostic/);
    expect(all).toMatch(/do not by themselves mean that a transformation is required/i);
  });

  // ── B. declared_scale_mismatch + concerning diagnostics (non-regression) ─

  it("B — mismatch row with concerning diagnostics: row and footer both remain correct", () => {
    render(
      <UnrecommendableStateNotice
        items={[item({ trait: "Response_value", state: "declared_scale_mismatch", ...CONCERNING_P })]}
      />
    );
    const row = screen.getByTestId("unrecommendable-Response_value").textContent ?? "";
    expect(row).toMatch(/conflicts with the observed data/i);
    expect(row).toMatch(/Shapiro-Wilk p = 0\.006/);
    expect(row).toMatch(/Levene p = 0\.994/);

    const all = screen.getByTestId("unrecommendable-states").textContent ?? "";
    expect(all.toLowerCase()).not.toMatch(/significant diagnostic/);
    expect(all).toMatch(/do not by themselves mean that a transformation is required/i);
    expect(all).toMatch(/remains the result of record/i);
  });

  // ── C. scale_unknown + concerning diagnostics ───────────────────────────

  it("C — scale_unknown row and diagnostics unchanged", () => {
    render(
      <UnrecommendableStateNotice
        items={[item({ trait: "Response_value", state: "scale_unknown", ...CONCERNING_P })]}
      />
    );
    const row = screen.getByTestId("unrecommendable-Response_value").textContent ?? "";
    expect(row).toMatch(/response scale was not specified/i);
    expect(row).toMatch(/Shapiro-Wilk p = 0\.006/);
    expect(row).toMatch(/Levene p = 0\.994/);
  });

  // ── D. unsupported_scale + concerning diagnostics ───────────────────────

  it("D — unsupported_scale row and diagnostics unchanged", () => {
    render(
      <UnrecommendableStateNotice
        items={[item({ trait: "Response_value", state: "unsupported_scale", ...CONCERNING_P })]}
      />
    );
    const row = screen.getByTestId("unrecommendable-Response_value").textContent ?? "";
    expect(row).toMatch(/no governed automatic transformation/i);
    expect(row).toMatch(/Shapiro-Wilk p = 0\.006/);
    expect(row).toMatch(/Levene p = 0\.994/);
  });

  // ── E. MIXED-TRAIT LOAD-BEARING CASE ─────────────────────────────────────
  // Trait A: scale_unknown, concerning. Trait B: declared_scale_mismatch,
  // CLEAN. Trait C: unsupported_scale, concerning. One shared footer must
  // cover all three simultaneously without making any diagnostic-outcome
  // claim, since B's diagnostics are clean while A's and C's are not.

  it("E — mixed states/diagnostics in one notice: one footer, correct per-trait rows, no cross-contamination", () => {
    render(
      <UnrecommendableStateNotice
        items={[
          item({ trait: "TraitA", state: "scale_unknown", ...CONCERNING_P }),
          item({ trait: "TraitB", state: "declared_scale_mismatch", ...CLEAN_P }),
          item({ trait: "TraitC", state: "unsupported_scale", shapiroP: 0.02, leveneP: 0.5 }),
        ]}
      />
    );

    // Exactly one shared footer / one container.
    expect(screen.getAllByTestId("unrecommendable-states")).toHaveLength(1);
    const all = screen.getByTestId("unrecommendable-states").textContent ?? "";
    const footerOccurrences = all.match(/do not by themselves mean that a transformation is required/g) ?? [];
    expect(footerOccurrences).toHaveLength(1);

    // Each trait appears exactly once with its own state and diagnostics.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    const rowA = screen.getByTestId("unrecommendable-TraitA").textContent ?? "";
    const rowB = screen.getByTestId("unrecommendable-TraitB").textContent ?? "";
    const rowC = screen.getByTestId("unrecommendable-TraitC").textContent ?? "";

    expect(rowA).toMatch(/response scale was not specified/i);
    expect(rowA).toMatch(/Shapiro-Wilk p = 0\.006/);
    expect(rowA).toMatch(/Levene p = 0\.994/);

    expect(rowB).toMatch(/conflicts with the observed data/i);
    expect(rowB).toMatch(/Shapiro-Wilk p = 0\.736/);
    expect(rowB).toMatch(/Levene p = 0\.983/);

    expect(rowC).toMatch(/no governed automatic transformation/i);
    expect(rowC).toMatch(/Shapiro-Wilk p = 0\.02/);
    expect(rowC).toMatch(/Levene p = 0\.5/);

    // No diagnostic value crossed between traits.
    expect(rowA).not.toMatch(/0\.736|0\.983/);
    expect(rowB).not.toMatch(/0\.006|0\.994/);
    expect(rowC).not.toMatch(/0\.736|0\.006/);

    // Shared footer makes no pass/fail diagnostic claim, mentions no
    // significant test, and is not repeated per trait (boilerplate is not
    // duplicated -- already proven by footerOccurrences === 1 above).
    expect(all.toLowerCase()).not.toMatch(/significant diagnostic/);
    expect(all).not.toMatch(/assumptions (were )?(met|satisfied)/i);
  });

  // ── F. NON-REGRESSION — scale_unknown alone ─────────────────────────────
  // Proves the new shared wording is still correct for the pre-existing,
  // single-state scenario this component originally shipped with.

  it("F — scale_unknown alone: existing row wording unchanged, new footer is valid in isolation", () => {
    render(
      <UnrecommendableStateNotice
        items={[item({ trait: "Response_value", state: "scale_unknown", ...CONCERNING_P })]}
      />
    );
    // No declared_scale_mismatch or unsupported_scale trait present.
    expect(screen.queryByText(/conflicts with the observed data/i)).toBeNull();
    expect(screen.queryByText(/no governed automatic transformation/i)).toBeNull();

    const row = screen.getByTestId("unrecommendable-Response_value").textContent ?? "";
    expect(row).toMatch(/response scale was not specified/i);
    expect(row).toMatch(/no automatic transformation was recommended/i);

    const all = screen.getByTestId("unrecommendable-states").textContent ?? "";
    expect(all).toMatch(/do not by themselves mean that a transformation is required/i);
    expect(all).not.toMatch(/assumptions (were )?(met|satisfied)/i);
    expect(all.toLowerCase()).not.toMatch(/significant diagnostic/);
    expect(all).not.toMatch(/\bmust\b|(?<!transformation is )\brequired\b/i);
    expect(all).toMatch(/remains the result of record/i);

    // Exactly one shared footer.
    const occurrences = all.match(/do not by themselves mean that a transformation is required/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
