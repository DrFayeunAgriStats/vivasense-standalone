import { describe, expect, it } from "vitest";
import { initialAnovaSelections } from "./sampleAnalysisDefaults";

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
  it("never infers CRD from arbitrary user data", () => {
    expect(initialAnovaSelections({availableTraitColumns: ["Yield"]}))
      .toEqual({design: "rcbd", traits: ["Yield"]});
    expect(initialAnovaSelections({sampleId: "unknown", availableTraitColumns: ["Yield"]}).design)
      .toBe("rcbd");
    expect(initialAnovaSelections(null)).toEqual({design: "rcbd", traits: []});
  });
});
