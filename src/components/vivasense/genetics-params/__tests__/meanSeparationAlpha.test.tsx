/**
 * Release-blocker regression: the mean-separation footer must state the alpha
 * the analysis was actually run at.
 *
 * The footer beneath the detailed Tukey table read "Tukey HSD, α = 0.05" as a
 * literal, so an α = 0.10 run showed 0.10 in the governed decision card and
 * 0.05 three inches below it — the same contradiction class as FB-1, where a
 * report asserted significance at a threshold the analysis never used.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcademicResultsPanel } from "../AcademicResultsPanel";

const anovaTable = {
  source: ["rep", "genotype", "Residuals"],
  df: [3, 3, 9],
  ss: [1.2, 8.4, 2.1],
  ms: [0.4, 2.8, 0.23],
  f_value: [1.71, 12.0, null],
  p_value: [0.23, 0.0016, null],
};

const separation = (alpha: number, test = "Tukey HSD") => ({
  genotype: ["T4", "T3", "T2", "T1"],
  mean: [12.4, 11.8, 10.2, 9.6],
  se: [0.31, 0.31, 0.31, 0.31],
  group: ["a", "ab", "bc", "c"],
  test,
  alpha,
});

/** The detailed tables live behind "Show Detailed Statistics"; open it. */
function openDetails() {
  fireEvent.click(screen.getByText(/Show Detailed Statistics/i));
}

function renderPanel(alpha: number, sepAlpha = alpha, test = "Tukey HSD") {
  const r = render(
    <AcademicResultsPanel
      moduleLabel="ANOVA"
      domainNeutral
      anovaTable={anovaTable}
      meanSeparation={separation(sepAlpha, test)}
      inferentialAlpha={alpha}
    />
  );
  openDetails();
  return r;
}

describe("mean-separation footer states the selected alpha", () => {
  for (const alpha of [0.01, 0.05, 0.1]) {
    it(`renders α = ${alpha.toFixed(2)} when the analysis used ${alpha}`, () => {
      renderPanel(alpha);
      const footer = screen.getByText(/Means with the same letter are not significantly different/i);
      expect(footer.textContent).toContain(`α = ${alpha.toFixed(2)}`);
    });
  }

  it("does NOT show 0.05 for an α = 0.10 analysis — the reported defect", () => {
    renderPanel(0.1);
    const footer = screen.getByText(/Means with the same letter are not significantly different/i);
    expect(footer.textContent).toContain("α = 0.10");
    expect(footer.textContent).not.toContain("0.05");
  });

  it("does NOT show 0.05 for an α = 0.01 analysis", () => {
    renderPanel(0.01);
    const footer = screen.getByText(/Means with the same letter are not significantly different/i);
    expect(footer.textContent).toContain("α = 0.01");
    expect(footer.textContent).not.toContain("0.05");
  });

  it("prefers the backend separation object's own alpha over the prop", () => {
    // The letters were produced at the backend's alpha; that is what the
    // caption describes, so it wins if the two ever disagree.
    renderPanel(0.1, 0.05);
    const footer = screen.getByText(/Means with the same letter are not significantly different/i);
    expect(footer.textContent).toContain("α = 0.05");
  });

  it("keeps 0.05 for legacy callers that pass no alpha", () => {
    render(
      <AcademicResultsPanel
        moduleLabel="ANOVA"
        anovaTable={anovaTable}
        meanSeparation={{ ...separation(0.05), alpha: undefined }}
      />
    );
    openDetails();
    const footer = screen.getByText(/Means with the same letter are not significantly different/i);
    expect(footer.textContent).toContain("α = 0.05");
  });
});

describe("mean-separation method is not hardcoded to Tukey", () => {
  it("names Protected Fisher's LSD when that is what the backend ran", () => {
    renderPanel(0.05, 0.05, "Protected Fisher's LSD");
    expect(screen.getByText(/Mean Separation \(Protected Fisher's LSD\)/)).toBeTruthy();
    const footer = screen.getByText(/Means with the same letter are not significantly different/i);
    expect(footer.textContent).toContain("Protected Fisher's LSD");
    expect(footer.textContent).not.toContain("Tukey");
  });

  it("falls back to Tukey HSD when the backend named no method", () => {
    render(
      <AcademicResultsPanel
        moduleLabel="ANOVA"
        anovaTable={anovaTable}
        meanSeparation={{ ...separation(0.05), test: undefined }}
        inferentialAlpha={0.05}
      />
    );
    openDetails();
    expect(screen.getByText(/Mean Separation \(Tukey HSD\)/)).toBeTruthy();
  });
});

describe("ANOVA p-value highlighting follows the selected alpha", () => {
  it("states the selected alpha in the legend rather than a fixed ladder", () => {
    renderPanel(0.1);
    const legend = screen.getByText(/Highlighted p-values meet the selected significance level/i);
    expect(legend.textContent).toContain("0.10");
  });

  it("states 0.01 for an α = 0.01 analysis", () => {
    renderPanel(0.01);
    const legend = screen.getByText(/Highlighted p-values meet the selected significance level/i);
    expect(legend.textContent).toContain("0.01");
  });

  it("no longer advertises the fixed 0.05/0.01/0.001 star ladder", () => {
    renderPanel(0.1);
    expect(screen.queryByText(/\*\s*p&lt;0\.05/)).toBeNull();
    expect(screen.queryByText(/\*\*\* p<0\.001/)).toBeNull();
  });
});
