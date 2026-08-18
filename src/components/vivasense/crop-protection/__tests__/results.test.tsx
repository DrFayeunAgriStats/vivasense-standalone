/**
 * Results rendering, asserted against real captured backend responses.
 *
 * Covers the scientific guarantees that must not regress: no Rep ANOVA source,
 * interaction-first ordering, Tukey letters on the display scale, the raw vs
 * inference note, Abbott's N/A control cell, the co-toxicity vocabulary that
 * preserves uncertainty, and the data-quality warnings.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BioassayResults } from "../BioassayResults";
import {
  alclDefinitions,
  alclResult,
  clbDefinitions,
  clbResult,
  dorcasDefinitions,
  dorcasResult,
} from "@/test/fixtures/cropProtection";

const renderDorcas = () =>
  render(
    <BioassayResults results={dorcasResult} definitions={dorcasDefinitions} alpha={0.05} />
  );

describe("Study design (Dorcas fixture)", () => {
  it("reports the factorial CRD structure the backend measured", () => {
    renderDorcas();
    // Scope to the design card: the same figures recur in tables further down.
    const heading = screen.getByText("Study Design");
    let card: HTMLElement | null = heading.parentElement;
    while (card && !card.textContent?.includes("Factorial observations")) {
      card = card.parentElement;
    }
    const text = (card?.textContent ?? "").replace(/\s+/g, " ");
    // 3 treatments x 5 doses x 3 reps = 45 factorial observations, 3 control.
    expect(text).toContain("Design: Factorial CRD");
    expect(text).toContain("Treatments: 3");
    expect(text).toContain("Doses: 5");
    expect(text).toContain("Factorial observations: 45");
    expect(text).toContain("Control observations: 3");
    expect(text).toContain("Replicates per cell: 3");
    expect(text).toContain("Balanced: Yes");
    expect(text).toContain("CL, TD, CLTD");
  });
});

describe("ANOVA table", () => {
  it("shows Treatment, Dose, Treatment × Dose and Error", () => {
    renderDorcas();
    const tables = screen.getAllByRole("table");
    const anova = tables[0];
    expect(within(anova).getByText("Treatment")).toBeInTheDocument();
    expect(within(anova).getByText("Dose")).toBeInTheDocument();
    expect(within(anova).getByText("Treatment × Dose")).toBeInTheDocument();
    expect(within(anova).getByText("Error")).toBeInTheDocument();
  });

  it("never shows Rep as an ANOVA source", () => {
    renderDorcas();
    expect(screen.queryByText(/^Rep$/)).toBeNull();
    expect(screen.queryByText(/^Replicate$/)).toBeNull();
    expect(screen.queryByText(/^Block$/)).toBeNull();
    expect(
      screen.getAllByText(/Replicate identifies independent experimental units/i).length
    ).toBeGreaterThan(0);
  });

  it("formats small p-values as <0.001 rather than 0.0000", () => {
    renderDorcas();
    expect(screen.getAllByText("<0.001").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0000")).toBeNull();
  });
});

describe("Interaction-first mean separation", () => {
  it("renders the Treatment × Dose matrix with Tukey letters", () => {
    renderDorcas();
    expect(screen.getAllByText("Treatment × Dose Means").length).toBeGreaterThan(0);
    // Dorcas mortality_72h, CL at dose 0.2: 76.67 ± 12.02 on the display scale.
    expect(screen.getAllByText(/76\.67 ± 12\.02/).length).toBeGreaterThan(0);
  });

  it("puts the interaction matrix before the marginal means when it is significant", () => {
    const { container } = renderDorcas();
    const text = container.textContent ?? "";
    const interactionIndex = text.indexOf("Treatment × Dose Means");
    const marginalIndex = text.indexOf("Treatment Means");
    expect(interactionIndex).toBeGreaterThan(-1);
    expect(marginalIndex).toBeGreaterThan(interactionIndex);
  });

  it("demotes marginal means with an explicit caution", () => {
    renderDorcas();
    expect(
      screen.getAllByText(/interaction is significant\. Marginal means are secondary/i).length
    ).toBeGreaterThan(0);
  });

  it("explains the Tukey letters", () => {
    renderDorcas();
    expect(
      screen.getAllByText(/sharing at least one letter are not significantly different/i).length
    ).toBeGreaterThan(0);
  });

  it("states the inference vs display scale when they differ", () => {
    renderDorcas();
    // mortality_72h: ANOVA on AdtM72, means displayed as Mort72_pct.
    expect(screen.getAllByText(/AdtM72/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mort72_pct/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Tukey grouping is based on the declared inference variable/i).length
    ).toBeGreaterThan(0);
  });
});

describe("Abbott mortality", () => {
  it("shows the control as a reference rather than a corrected percentage", () => {
    renderDorcas();
    expect(screen.getAllByText("N/A — reference").length).toBeGreaterThan(0);
  });

  it("shows control mortality prominently", () => {
    renderDorcas();
    expect(screen.getAllByText(/Control mortality at 72 h: 40\.0%/).length).toBeGreaterThan(0);
  });

  it("warns when Abbott flooring was applied", () => {
    renderDorcas();
    expect(screen.getAllByText(/Abbott values floored at zero/i).length).toBeGreaterThan(0);
  });
});

describe("Data-quality warnings", () => {
  it("renders the cumulative-mortality decrease with its experimental unit", () => {
    renderDorcas();
    expect(screen.getByText("Cumulative mortality decreased")).toBeInTheDocument();
    expect(
      screen.getByText(/Mortality decreased from 30% at 48 to 20% at 72 for TD, Dose 0\.2, Replicate 2/i)
    ).toBeInTheDocument();
  });

  it("renders the high-control-mortality advisory without invalidating the run", () => {
    renderDorcas();
    expect(screen.getAllByText("High control mortality").length).toBeGreaterThan(0);
    expect(screen.getByText(/do not invalidate the experiment/i)).toBeInTheDocument();
  });

  it("puts alerts before the first inferential section", () => {
    const { container } = renderDorcas();
    const text = container.textContent ?? "";
    expect(text.indexOf("Data Quality Alerts")).toBeLessThan(text.indexOf("ANOVA"));
  });
});

describe("Diagnostics", () => {
  it("reports a failed normality test as questionable, not satisfied", () => {
    renderDorcas();
    expect(screen.getAllByText("Questionable").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Shapiro-Wilk p = <0\.001|Shapiro-Wilk p = 0\.0030/).length)
      .toBeGreaterThan(0);
  });
});

describe("Regression and correlation", () => {
  it("labels a significant increasing dose trend", () => {
    renderDorcas();
    expect(screen.getAllByText("Significant increasing trend").length).toBeGreaterThan(0);
  });

  it("states that the control is not included as dose 0", () => {
    renderDorcas();
    expect(
      screen.getByText(/untreated control is not included as dose 0/i)
    ).toBeInTheDocument();
  });

  it("does not label correlation as genotypic or phenotypic", () => {
    renderDorcas();
    expect(screen.queryByText(/genotypic correlation/i)).toBeNull();
    expect(screen.queryByText(/phenotypic correlation/i)).toBeNull();
    expect(screen.getByText(/Pearson correlation on the biological\/raw scale/i))
      .toBeInTheDocument();
  });
});

describe("Co-toxicity — AL + CL -> ALCL", () => {
  it("renders the Bliss expectation and observed mixture for dose 0.2 at 48 h", () => {
    render(<BioassayResults results={alclResult} definitions={alclDefinitions} alpha={0.05} />);
    expect(screen.getByText(/Observation time 48 h/)).toBeInTheDocument();
    expect(screen.getAllByText("50.0").length).toBeGreaterThan(0);   // expected
    expect(screen.getAllByText("70.8").length).toBeGreaterThan(0);   // observed
    expect(screen.getAllByText("+20.83").length).toBeGreaterThan(0); // excess
  });

  it("does not call an inconclusive positive deviation synergistic", () => {
    render(<BioassayResults results={alclResult} definitions={alclDefinitions} alpha={0.05} />);
    expect(
      screen.getAllByText("Positive deviation — not distinguishable from additivity").length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/^Synergistic$/)).toBeNull();
    expect(screen.queryByText(/Supports synergy under Bliss independence/)).toBeNull();
  });
});

describe("Co-toxicity — CL + B -> CLB", () => {
  it("renders a supported antagonism at 24 h", () => {
    render(<BioassayResults results={clbResult} definitions={clbDefinitions} alpha={0.05} />);
    expect(screen.getByText(/Observation time 24 h/)).toBeInTheDocument();
    expect(
      screen.getAllByText("Supports antagonism under Bliss independence").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("-71.98").length).toBeGreaterThan(0);
  });

  it("keeps the repeated control at n = 3 under the declared policy", () => {
    render(<BioassayResults results={clbResult} definitions={clbDefinitions} alpha={0.05} />);
    expect(screen.getByText("Repeated control blocks detected")).toBeInTheDocument();
    expect(screen.getAllByText(/Control n = 3/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/single unique 3-replicate control profile was used/i)
    ).toBeInTheDocument();
  });

  it("shows Bliss as the method and never presents Sun–Johnson as active", () => {
    render(<BioassayResults results={clbResult} definitions={clbDefinitions} alpha={0.05} />);
    expect(screen.getByText("Method: Bliss independence")).toBeInTheDocument();
    expect(screen.queryByText(/Sun.Johnson/)).toBeNull();
  });
});

describe("Provenance", () => {
  it("exposes an Analysis Details panel", () => {
    renderDorcas();
    expect(screen.getByRole("button", { name: /Analysis Details/i })).toBeInTheDocument();
  });
});

describe("Domain terminology", () => {
  it("uses no genetics vocabulary anywhere in the results", () => {
    const { container } = renderDorcas();
    const text = (container.textContent ?? "").toLowerCase();
    for (const term of ["genotype", "environment", "heritability", "entry column"]) {
      expect(text).not.toContain(term);
    }
  });
});
