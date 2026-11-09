import { describe, expect, it } from "vitest";
import { allTutorials, tutorialCategories } from "@/data/helpLearningContent";

describe("workshop research-stage terminology", () => {
  it("uses Statistical Analysis for ANOVA guide categories, not the design-planning name", () => {
    expect(tutorialCategories).toContain("Statistical Analysis");
    expect(tutorialCategories).not.toContain("Experimental Design & ANOVA");
    for (const guide of allTutorials) {
      expect(guide.category).not.toBe("Experimental Design & ANOVA");
    }
  });
  it("routes ANOVA help to the unchanged analysis module", () => {
    const start = allTutorials.find(item => item.slug === "start-here");
    const run = allTutorials.find(item => item.slug === "run-analysis");
    expect(start?.actionPath).toBe("/workspace?module=anova");
    expect(start?.actionLabel).toBe("Open ANOVA & Mean Separation");
    expect(run?.description).toContain("ANOVA & Mean Separation workflow");
  });
  it("preserves the instructional task Choose the Correct Experimental Design", () => {
    const design = allTutorials.find(item => item.slug === "choose-design");
    expect(design?.title).toBe("Choose the Correct Experimental Design");
    expect(design?.actionPath).toBe("/workspace?module=anova");
  });
});
