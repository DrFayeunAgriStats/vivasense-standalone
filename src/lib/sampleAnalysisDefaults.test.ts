import { describe, expect, it } from "vitest";
import { initialAnovaSelections, initialSampleRoleMappings } from "./sampleAnalysisDefaults";

describe("sample-aware ANOVA onboarding", () => {
  it("starts the built-in CRD sample with CRD and Yield preselected", () => {
    expect(initialAnovaSelections({sampleId: "crd", availableTraitColumns: ["Yield"]}))
      .toEqual({design: "crd", traits: ["Yield"]});
  });
  it("uses valid builtin design hints and leaves multiple traits unselected", () => {
    expect(initialAnovaSelections({sampleId: "rcbd", availableTraitColumns: ["Yield", "Height"]}))
      .toEqual({design: "rcbd", traits: []});
    expect(initialAnovaSelections({sampleId: "factorial-rcbd", availableTraitColumns: ["Yield"]}).design)
      .toBe("factorial_rcbd");
  });
  it("pre-maps factors only for explicitly chosen built-in samples", () => {
    expect(initialSampleRoleMappings({sampleId: "factorial-crd", columns: ["Nitrogen", "Variety", "Yield"]}))
      .toMatchObject({factorA: "Nitrogen", factorB: "Variety"});
    expect(initialSampleRoleMappings({sampleId: "factorial-rcbd", columns: ["Block", "Nitrogen", "Variety", "Yield"]}))
      .toMatchObject({factorA: "Nitrogen", factorB: "Variety"});
    expect(initialSampleRoleMappings({sampleId: "split-plot-rcbd", columns: ["Block", "Nitrogen", "Variety", "Yield"]}))
      .toMatchObject({mainPlot: "Nitrogen", subPlot: "Variety"});
    expect(initialSampleRoleMappings({sampleId: "bioassay", columns: ["Treatment", "Dose", "Replicate", "MortalityPct"]}))
      .toMatchObject({factorA: "Treatment", factorB: "Dose"});
    expect(initialAnovaSelections({sampleId: "bioassay", availableTraitColumns: ["MortalityPct"]}).design)
      .toBe("factorial_rcbd");
    for (const sampleId of ["met", "met-crossover"]) {
      expect(initialAnovaSelections({sampleId, availableTraitColumns: ["Yield"]}).design)
        .toBe("rcbd");
    }
  });
  it("never pre-maps an arbitrary researcher upload or a missing column", () => {
    expect(initialSampleRoleMappings({sampleId: undefined, columns: ["Nitrogen", "Variety", "Yield"]}))
      .toEqual({factorA: "", factorB: "", mainPlot: "", subPlot: ""});
    expect(initialSampleRoleMappings({sampleId: "factorial-rcbd", columns: ["Nitrogen", "Yield"]}))
      .toEqual({factorA: "", factorB: "", mainPlot: "", subPlot: ""});
  });
  it("never infers CRD from arbitrary user data", () => {
    expect(initialAnovaSelections({availableTraitColumns: ["Yield"]}))
      .toEqual({design: "rcbd", traits: ["Yield"]});
    expect(initialAnovaSelections({sampleId: "unknown", availableTraitColumns: ["Yield"]}).design)
      .toBe("rcbd");
    expect(initialAnovaSelections(null)).toEqual({design: "rcbd", traits: []});
  });
});
