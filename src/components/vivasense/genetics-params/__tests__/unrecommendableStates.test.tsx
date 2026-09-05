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
      expect(all).toMatch(/does not by itself require a transformation/i);
      expect(all).toMatch(/remains the result of record/i);
      expect(all).not.toMatch(/\bmust\b|\brequired\b(?! a transformation)/i);
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
    const occurrences = all.match(/does not by itself require a transformation/g) ?? [];
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
