import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AnovaResultsTable } from "../AnovaResultsTable";
import { BioassayRoleMapping, type RoleMappingState } from "../BioassayRoleMapping";
import { InteractionMeansTable } from "../InteractionMeansTable";
import { InteractionPlot } from "../InteractionPlot";
import type { InteractionMean } from "@/types/cropProtection";

const cell = (VRT: string, FORM: string, LVL: string, mean: number): InteractionMean => ({
  treatment: VRT, dose: Number(LVL), n: 3, mean, se: 1.2, tukey_letter: "a",
  mean_inference_scale: mean, mean_display_scale: mean, se_inference_scale: 1.2,
  se_display_scale: 1.2, letter: "a", factor_levels: { VRT, FORM, LVL },
});
const means = [cell("V1", "F1", "1", 10), cell("V1", "F1", "2", 12),
  cell("V2", "F1", "1", 14), cell("V2", "F1", "2", 16),
  cell("V1", "F2", "1", 11), cell("V1", "F2", "2", 13),
  cell("V2", "F2", "1", 15), cell("V2", "F2", "2", 17),
  cell("V3", "F1", "1", 18), cell("V3", "F1", "2", 19),
  cell("V3", "F2", "1", 20), cell("V3", "F2", "2", 21)];

function StatefulMapping() {
  const [value, setValue] = useState<RoleMappingState>({ factors: [{ id: "factor_1", column: "", displayName: "", semanticRole: "" }], replicateColumn: "", controlLevel: "", doseSeriesText: "" });
  return <BioassayRoleMapping columns={["VRT", "FORM", "LVL", "REP"]} controlSuggestions={[]} value={value} onChange={setValue} />;
}

describe("dynamic factorial crop-protection UI", () => {
  it("builds up to three factors and explains the validated maximum", async () => {
    const user = userEvent.setup(); render(<StatefulMapping />);
    await user.click(screen.getByRole("button", { name: /Add Factor/i }));
    await user.click(screen.getByRole("button", { name: /Add Factor/i }));
    expect(screen.getByText("Factor 3 column")).toBeInTheDocument();
    expect(screen.getByText(/currently supports up to three factorial experimental factors/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Factor/i })).toBeDisabled();
  });

  it("renders every dynamic maize ANOVA source and excludes Rep", () => {
    render(<AnovaResultsTable alpha={0.05} rows={["VRT", "FORM", "LVL", "VRT × FORM", "VRT × LVL", "FORM × LVL", "VRT × FORM × LVL", "Error"].map((source, i) => ({ source, df: [3,1,3,3,9,3,9,64][i], ss: 1, ms: 1, f_value: source === "Error" ? null : 1, p_value: source === "Error" ? null : 0.1 }))} />);
    for (const source of ["VRT", "FORM", "LVL", "VRT × FORM", "VRT × LVL", "FORM × LVL", "VRT × FORM × LVL", "Error"]) expect(screen.getByText(source)).toBeInTheDocument();
    expect(screen.queryByText("Rep")).toBeNull();
  });

  it("renders three-factor means as tables faceted by the fewest-level factor", () => {
    render(<InteractionMeansTable means={means} />);
    expect(screen.getByText("VRT × FORM × LVL Means")).toBeInTheDocument();
    expect(screen.getByText("FORM = F1")).toBeInTheDocument();
    expect(screen.getByText("FORM = F2")).toBeInTheDocument();
  });

  it("renders one-factor means as a simple mean table", () => {
    const one = ["A", "B"].map((level, index) => ({ ...cell(level, "", "0", 10 + index), factor_levels: { Treatment: level } }));
    render(<InteractionMeansTable means={one} />);
    expect(screen.getByText("Treatment Means")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders three-factor interaction plots as matching facets", () => {
    render(<InteractionPlot means={means} responseLabel="OVI58" />);
    expect(screen.getByText("FORM = F1")).toBeInTheDocument();
    expect(screen.getByText("FORM = F2")).toBeInTheDocument();
    expect(screen.getByText(/panels show FORM, lines show VRT/i)).toBeInTheDocument();
  });
});
