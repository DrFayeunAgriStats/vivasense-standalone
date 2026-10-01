import { describe, expect, it } from "vitest";
import { allTutorials } from "../helpLearningContent";

describe("HELP-EA-02 operational help", () => {
  it("includes troubleshooting, support, templates, and diagnostic guidance", () => {
    const text = JSON.stringify(allTutorials);
    expect(text).toContain("support@vivasense.app");
    expect(text).toContain("not in index");
    expect(text).toContain("Cook's distance");
    expect(text).toContain("Shapiro-Wilk");
    expect(text).toContain("Tukey HSD");
    expect(text).toContain("/templates/vivasense-split-plot-rcbd-template.csv");
  });

  it("deep-links every governed design with an explicit design query", () => {
    const designGuides = ["crd", "rcbd", "factorial-crd", "factorial-rcbd", "split-plot-rcbd"];
    for (const slug of designGuides) {
      const guide = allTutorials.find((item) => item.slug === slug);
      expect(guide?.actionPath).toContain("module=anova");
      expect(guide?.actionPath).toContain("design=");
    }
  });

  it("explains the upload-stage treatment hint for factorial and split-plot users", () => {
    const prep = allTutorials.find((item) => item.slug === "prepare-dataset");
    const text = JSON.stringify(prep);
    expect(text).toContain("Treatment / Factor Hint");
    expect(text).toContain("Factor A/B");
    expect(text).toContain("whole-plot/subplot");
  });
});
