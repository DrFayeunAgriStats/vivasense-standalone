import { describe, expect, it } from "vitest";
import { buildStructuralPreview } from "../anovaDesigns";

describe("buildStructuralPreview", () => {
  it("does not present sampled RCBD level counts as full-dataset facts", () => {
    const preview = buildStructuralPreview(
      "rcbd",
      { treatment: "genotype", rep: "rep" },
      0.05,
      [
        { genotype: "T1", rep: "B1" },
        { genotype: "T1", rep: "B2" },
        { genotype: "T1", rep: "B3" },
        { genotype: "T2", rep: "B1" },
        { genotype: "T2", rep: "B2" },
      ],
      false,
    );

    const treatment = preview.rows.find((row) => row.label === "Treatment / Factor");
    expect(treatment?.value).toContain("≥2 levels visible in preview");

    const combinations = preview.rows.find((row) => row.label === "Treatment combinations");
    expect(combinations?.value).toContain("≥2 visible in preview");
    expect(combinations?.value).toContain("full dataset checked by engine");
  });

  it("shows exact counts when the preview contains the full dataset", () => {
    const preview = buildStructuralPreview(
      "rcbd",
      { treatment: "genotype", rep: "rep" },
      0.05,
      [
        { genotype: "T1", rep: "B1" },
        { genotype: "T2", rep: "B1" },
        { genotype: "T3", rep: "B1" },
      ],
      true,
    );

    const treatment = preview.rows.find((row) => row.label === "Treatment / Factor");
    expect(treatment?.value).toContain("3 levels");
    expect(treatment?.value).not.toContain("visible in preview");
  });
});
