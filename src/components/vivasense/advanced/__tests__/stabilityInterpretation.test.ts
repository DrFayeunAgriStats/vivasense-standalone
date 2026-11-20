import { describe, it, expect } from "vitest";
import { flagDisplay, combinedRankings, classicCsvRows, pCellText, rankingCsvRows, RANKING_TITLE, RANKING_EXPLANATION } from "../stability/interpretation";

const row = (o: Record<string, unknown> = {}) => ({ genotype: "G1", mean: 10, bi: 1, s2di: 0, rank: 1, stability_class: "stable", stability_description: "d",
  stability_class_label: "b_i = 1 and S2d_i = 0 not rejected (exploratory; not evidence of stability or equality)", classification_status: "exploratory_provisional", ...o }) as never;

describe("provisional-status fail-safe", () => {
  it("shows the exploratory label when the payload says provisional", () => {
    const f = flagDisplay(row()); expect(f.provisional).toBe(true); expect(f.label).toMatch(/exploratory/); expect(f.tone).toBe("neutral");
  });
  it("never shows an unqualified class for a legacy payload", () => {
    for (const c of ["stable", "responsive_favorable", "responsive_poor", "unpredictable"]) {
      const f = flagDisplay(row({ stability_class: c, classification_status: undefined, stability_class_label: undefined }));
      expect(f.tone).toBe("unknown"); expect(f.label).toBe("classification not shown (provisional status missing from the result)"); expect(f.label).not.toMatch(/^stable$/);
    }
    expect(flagDisplay(row({ classification_status: "validated" })).tone).toBe("unknown");
  });
  it("exact-fit tooltip does not append the generic 'failing to reject' note", () => {
    const f = flagDisplay(row({ b_inference_status: "exact_fit", stability_description: "deterministic comparison, NOT a significance test" }));
    expect(f.title).not.toMatch(/failing to reject/); expect(f.title).toMatch(/deterministic comparison/);
  });
});

describe("withheld values are explained, not blank or zero", () => {
  const fmt = (v: number, d: number) => v.toFixed(d);
  it("p cells", () => {
    expect(pCellText(0.1234, "ok", fmt)).toBe("0.123");
    expect(pCellText(null, "exact_fit", fmt)).toBe("exact fit: no test");
    expect(pCellText(null, "indeterminate", fmt)).toBe("indeterminate");
    expect(pCellText(undefined, undefined, fmt)).toBe("—");
  });
});

describe("combined rankings", () => {
  const res = { genotype_stability: [row({ genotype: "A", rank_s2di: 2, rank_shukla: 1 }), row({ genotype: "B", rank_s2di: 1, rank_shukla: 3 }), row({ genotype: "C" })] } as never;
  it("is an equal-weight mean of available ranks; unranked genotypes get null, not Infinity", () => {
    const r = combinedRankings(res);
    expect(r.find((x) => x.genotype === "A")?.combined_rank).toBe(1.5);
    expect(r.find((x) => x.genotype === "B")?.combined_rank).toBe(2);
    expect(r.find((x) => x.genotype === "C")?.combined_rank).toBeNull();
    expect(JSON.stringify(rankingCsvRows(r))).not.toMatch(/Infinity|NaN/);
  });
  it("wording is neutral", () => {
    expect(RANKING_TITLE).toBe("Exploratory combined stability rankings");
    expect(RANKING_EXPLANATION).toMatch(/not a significance test/); expect(RANKING_EXPLANATION).toMatch(/does not show that any genotype is stable/);
    expect(RANKING_TITLE + RANKING_EXPLANATION).not.toMatch(/consensus/i);
  });
});

describe("exports", () => {
  it("legacy rows are never exported with a raw class id", () => {
    const out = classicCsvRows([row({ classification_status: undefined, stability_class_label: undefined })]);
    expect(out[0].stability_class).toBe("not_shown"); expect(out[0].classification_status).toBe("missing");
  });
});
