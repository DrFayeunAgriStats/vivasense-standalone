import { describe, it, expect } from "vitest";
import { deriveStageDates } from "./stageDates";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

const row = (created_at: string, analysis_type = "anova") => ({created_at,analysis_type} as AnalysisHistoryRecord);
describe("workflow recorded dates", () => {
  it("uses the latest recorded ANOVA and does not invent a dataset-upload date", () => {
    const dates = deriveStageDates([row("2026-08-05T07:00:00Z"),row("2026-11-08T20:00:00Z")]);
    expect(dates.anova).toBe("2026-11-08T20:00:00Z");
    expect(dates["dataset-upload"]).toBeUndefined();
  });
  it("does not display invalid or nonexistent history dates", () => {
    expect(deriveStageDates([]).anova).toBeUndefined();
    expect(deriveStageDates([row("invalid")]).anova).toBeUndefined();
  });
});
