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

  it("groups field layout guidance under Design & Planning without changing its tool route", () => {
    expect(tutorialCategories).toContain("Design & Planning");
    expect(tutorialCategories).not.toContain("Field Layout");
    const field = allTutorials.find(item => item.slug === "field-layout");
    expect(field?.category).toBe("Design & Planning");
    expect(field?.actionPath).toBe("/workspace?module=field-layout");
    expect(field?.actionLabel).toBe("Open Field Layout");
  });
  it("uses British spelling in displayed guide text and titles", () => {
    const crd = allTutorials.find(item => item.slug === "crd");
    const rcbd = allTutorials.find(item => item.slug === "rcbd");
    const choose = allTutorials.find(item => item.slug === "choose-design");
    expect(crd?.title).toBe("CRD — Completely Randomised Design");
    expect(rcbd?.title).toBe("RCBD — Randomised Complete Block Design");
    expect(choose?.description).toContain("randomisation structure");
    for (const guide of allTutorials) {
      const visible = [guide.title, guide.description, guide.actionLabel,
        ...guide.sections.flatMap(section => [section.title, ...section.steps, section.note ?? ""])
      ].join(" ");
      expect(visible).not.toMatch(/randomiz(?:ed|ation)/i);
    }
  });
});
