/**
 * FE-BETA-02 — table / panel rendering against the REAL smoke-kit payloads.
 * No statistical value is recomputed here; the tests only check what reaches
 * the screen.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

import { AcademicResultsPanel } from "../AcademicResultsPanel";
import { GovernedFactorialPanel } from "../GovernedFactorialPanel";
import { GovernedSplitPlotPanel } from "../GovernedSplitPlotPanel";
import { readFactorialProfile, readInteractionPlot } from "../governedFactorial";
import { readSplitPlotInteractionPlot, readSplitPlotProfile } from "../governedSplitPlot";

import crd01 from "@/test/fixtures/smokeKit/VS_Smoke_01_CRD.json";
import rcbd03 from "@/test/fixtures/smokeKit/VS_Smoke_03_RCBD.json";
import factRcbd04 from "@/test/fixtures/smokeKit/VS_Smoke_04_Factorial_RCBD.json";
import split05 from "@/test/fixtures/smokeKit/VS_Smoke_05_SplitPlot_RCBD.json";

type Payload = Record<string, any>;
const resultOf = (p: Payload) => (Object.values(p.trait_results as Record<string, any>)[0] as any).analysis_result.result;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const openDetails = () =>
  fireEvent.click(screen.getByText(/^(View ANOVA Table( & Mean Separation)?|Show Detailed Statistics)$/));

const rowByText = (text: string | RegExp) => screen.getByText(text).closest("tr") as HTMLElement;
const pCell = (row: HTMLElement) => within(row).getAllByRole("cell").at(-1) as HTMLElement;

describe("3. replication / block p-values are not styled as treatment findings", () => {
  it("RCBD with a SIGNIFICANT replication effect: treatment is emphasised, replication is not, both p-values stay visible", () => {
    const table = clone(resultOf(rcbd03).anova_table);
    // Real table, with the replication p-value forced small to exercise the rule.
    table.p_value = [0.0012, 0.0031, null];
    render(
      <AcademicResultsPanel moduleLabel="ANOVA" domainNeutral anovaTable={table} inferentialAlpha={0.05} />,
    );
    openDetails();

    const repRow = rowByText("rep");
    const treatmentRow = rowByText("genotype");
    // Numerical p-values are never suppressed or altered.
    expect(pCell(repRow).textContent).toBe("0.0012 **");
    expect(pCell(treatmentRow).textContent).toBe("0.0031 **");
    // Only the treatment row carries the emphasis styling.
    expect(pCell(treatmentRow).className).toMatch(/font-semibold/);
    expect(pCell(treatmentRow).className).toMatch(/emerald/);
    expect(pCell(repRow).className).not.toMatch(/font-semibold/);
    expect(pCell(repRow).className).not.toMatch(/emerald/);
    // The legend says so.
    expect(screen.getByText(/replication \/ block rows are never highlighted/i)).toBeInTheDocument();
  });

  it("a Split-Plot 'Replication' row is treated the same way", () => {
    const table = clone(resultOf(split05).anova_table);
    table.p_value = table.p_value.map((p: number | null, i: number) => (i === 0 ? 0.0004 : p));
    render(<AcademicResultsPanel moduleLabel="ANOVA" domainNeutral anovaTable={table} inferentialAlpha={0.01} />);
    openDetails();
    expect(pCell(rowByText("Replication")).className).not.toMatch(/emerald/);
    expect(pCell(rowByText("irrigation")).className).toMatch(/emerald/);
  });
});

describe("2. ANOVA labels", () => {
  it("shows the backend display_source ('treatment'), not the internal 'genotype' key (real CRD payload)", () => {
    render(
      <AcademicResultsPanel moduleLabel="ANOVA" domainNeutral anovaTable={resultOf(crd01).anova_table} inferentialAlpha={0.05} />,
    );
    openDetails();
    expect(screen.getByText("treatment")).toBeInTheDocument();
    expect(screen.queryByText(/^genotype$/i)).toBeNull();
  });

  it("falls back to neutral labels for an older payload without display_source", () => {
    const legacy = { ...clone(resultOf(rcbd03).anova_table) };
    delete legacy.display_source;
    render(<AcademicResultsPanel moduleLabel="ANOVA" domainNeutral anovaTable={legacy} inferentialAlpha={0.05} />);
    openDetails();
    expect(screen.getByText("Treatment")).toBeInTheDocument();
    expect(screen.getByText("Replication / Block")).toBeInTheDocument();
    expect(screen.queryByText(/^genotype$/i)).toBeNull();
  });

  it("the genetics (non-domain-neutral) caller keeps its own labels and control name", () => {
    render(<AcademicResultsPanel moduleLabel="Genetic Parameters" anovaTable={resultOf(crd01).anova_table} />);
    expect(screen.getByText("Show Detailed Statistics")).toBeInTheDocument();
    openDetails();
    expect(screen.getByText("genotype")).toBeInTheDocument();
  });
});

describe("4. mean-separation objects reach the screen with the backend's letters", () => {
  const letters = (rows: HTMLElement[]) => rows.map((r) => (r.textContent ?? "").replace(/\s+/g, " "));

  it("CRD (VS_Smoke_01): Tukey–Kramer letters 4=a, 2=b, 3=bc, 1=c, in ranked order", () => {
    render(
      <AcademicResultsPanel
        moduleLabel="ANOVA" domainNeutral inferentialAlpha={0.05}
        anovaTable={resultOf(crd01).anova_table} meanSeparation={resultOf(crd01).mean_separation}
      />,
    );
    openDetails();
    const rows = within(screen.getAllByRole("table")[1]).getAllByRole("row").slice(1) as HTMLElement[];
    const pairs = rows.map((r) => {
      const cells = within(r).getAllByRole("cell");
      return [cells[0].textContent, cells[2].textContent];
    });
    expect(pairs).toEqual([["4", "a"], ["2", "b"], ["3", "bc"], ["1", "c"]]);
    expect(letters(rows)).toHaveLength(4);
    expect(screen.getByText(/Mean Separation \(Tukey HSD\)/)).toBeInTheDocument();
  });

  it("RCBD (VS_Smoke_03): the backend ranking and letters are shown unchanged", () => {
    const sep = resultOf(rcbd03).mean_separation;
    render(
      <AcademicResultsPanel
        moduleLabel="ANOVA" domainNeutral inferentialAlpha={0.05}
        anovaTable={resultOf(rcbd03).anova_table} meanSeparation={sep}
      />,
    );
    openDetails();
    const rows = within(screen.getAllByRole("table")[1]).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(sep.genotype.length);
    rows.forEach((row, i) => {
      expect(within(row).getAllByRole("cell")[0].textContent).toBe(sep.genotype[i]);
      expect(within(row).getAllByRole("cell")[2].textContent).toBe(sep.group[i]);
    });
  });

  it("Factorial RCBD (VS_Smoke_04): marginal tables keep the backend ranking N120, N60, N0 with letters a, b, c", () => {
    render(
      <GovernedFactorialPanel design="factorial_rcbd" result={resultOf(factRcbd04)} mapping={{ rep: "rep" }} inferentialAlpha={0.05} />,
    );
    const rows = ["N120", "N60", "N0"].map((level) => screen.getAllByText(level)[0].closest("tr") as HTMLElement);
    const group = (row: HTMLElement) => (row.textContent ?? "").trim().slice(-1);
    expect(rows.map(group)).toEqual(["a", "b", "c"]);
    // Ranked means come first in DOM order: N120 above N60 above N0.
    expect(rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[1].compareDocumentPosition(rows[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Split-Plot (VS_Smoke_05): interaction governs, so marginal letters are withheld; error strata and cell means are shown", () => {
    // Governed hierarchy (preserved, not changed here): with a significant
    // irrigation × variety interaction the marginal LSD letters are not the
    // primary result, so no marginal Group table is rendered.
    render(
      <GovernedSplitPlotPanel
        result={resultOf(split05)}
        mapping={{ rep: "rep", mainPlot: "irrigation", subPlot: "variety" }}
        inferentialAlpha={0.01}
      />,
    );
    expect(screen.getAllByText(/interaction governs/i).length).toBeGreaterThan(0);
    const tables = screen.getAllByRole("table");
    const headers = tables.map((t) => within(t).getAllByRole("columnheader").map((h) => h.textContent));
    expect(headers.some((h) => h.includes("Group"))).toBe(false);

    // Error strata with the denominators the backend actually used (0.4167 / 0.0175).
    const strata = tables[0];
    expect(strata.textContent).toContain("Error A (whole-plot, Block x A)");
    expect(strata.textContent).toContain("Error B (subplot)");
    expect(within(strata).getByText("0.4167")).toBeInTheDocument();
    expect(within(strata).getByText("0.0175")).toBeInTheDocument();
    // The descriptive cell means (the interaction pattern) are shown.
    expect(headers.some((h) => h.join("|") === "irrigation|variety|Cell arithmetic mean")).toBe(true);
  });
});

describe("5. level_order drives UNRANKED presentation, keeping every point aligned", () => {
  it("Factorial profile and plot axes follow level_order even if the payload lists are scrambled", () => {
    const result = clone(resultOf(factRcbd04));
    result.factorial_profile.factor_a_levels = ["N120", "N0", "N60"];
    for (const s of result.interaction_plot.series) {
      s.factor_a_levels = ["N120", "N0", "N60"];
    }
    result.interaction_plot.x_axis_levels = ["N120", "N0", "N60"];
    // Means paired with the scrambled levels: N120→30, N0→10, N60→20 for the first series.
    result.interaction_plot.series[0].mean = [30, 10, 20];
    result.interaction_plot.series[0].n = [3, 3, 3];

    const profile = readFactorialProfile(result, "factorial_rcbd", { rep: "rep" })!;
    expect(profile.factorALevels).toEqual(["N0", "N60", "N120"]);

    const plot = readInteractionPlot(result)!;
    expect(plot.xLevels).toEqual(["N0", "N60", "N120"]);
    // The first series' means moved WITH their levels: N0→10, N60→20, N120→30.
    expect(plot.series[0].xLevels).toEqual(["N0", "N60", "N120"]);
    expect(plot.series[0].means).toEqual([10, 20, 30]);
  });

  it("the real Factorial RCBD payload already displays N0, N60, N120 (VS_Smoke_04)", () => {
    const result = resultOf(factRcbd04);
    expect(readFactorialProfile(result, "factorial_rcbd", { rep: "rep" })!.factorALevels).toEqual(["N0", "N60", "N120"]);
    expect(readInteractionPlot(result)!.xLevels).toEqual(["N0", "N60", "N120"]);
  });

  it("Split-Plot axes follow level_order and the series means are looked up by level", () => {
    const result = clone(resultOf(split05));
    result.split_plot_profile.whole_plot_levels = ["Irrigated", "Rainfed"];
    result.interaction_means.main_plot_levels = ["Irrigated", "Rainfed"];
    const info = readSplitPlotProfile(result, {})!;
    expect(info.wholePlotLevels).toEqual(["Rainfed", "Irrigated"]);

    const plot = readSplitPlotInteractionPlot(result, info)!;
    expect(plot.xLevels).toEqual(["Rainfed", "Irrigated"]);
    // V1 under Rainfed is the first cell mean of the real payload (2.8375).
    expect(plot.series[0].label).toBe("V1");
    expect(plot.series[0].means[0]).toBeCloseTo(2.8375, 4);
  });

  it("without level_order nothing is reordered", () => {
    const result = clone(resultOf(factRcbd04));
    delete result.level_order;
    result.factorial_profile.factor_a_levels = ["N120", "N0", "N60"];
    expect(readFactorialProfile(result, "factorial_rcbd", { rep: "rep" })!.factorALevels).toEqual(["N120", "N0", "N60"]);
  });
});

describe("4 (CV). only a backend-supplied CV is displayed, in neutral wording", () => {
  it("shows the CV exactly as supplied", () => {
    render(
      <AcademicResultsPanel
        moduleLabel="ANOVA" domainNeutral inferentialAlpha={0.05}
        anovaTable={resultOf(rcbd03).anova_table} cvPercent={3.19579}
      />,
    );
    openDetails();
    expect(screen.getByText("Experimental CV (%)").nextSibling?.textContent).toBe("3.20");
    expect(screen.queryByText(/acceptable|excellent|poor|reliable|high precision/i)).toBeNull();
  });

  it("shows nothing — and invents nothing — when the backend gave none (current validated payloads)", () => {
    render(
      <AcademicResultsPanel moduleLabel="ANOVA" domainNeutral inferentialAlpha={0.05} anovaTable={resultOf(rcbd03).anova_table} />,
    );
    openDetails();
    expect(screen.queryByText(/CV/)).toBeNull();
  });
});
