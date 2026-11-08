import { describe, expect, it } from "vitest";
import { answerStatisticalQuestion, isUnansweredStatisticalQuestion } from "./statisticsHelp";

describe("Ask VivaSense — statistics knowledge safeguards", () => {
  it("answers LSD versus Tukey rather than upload instructions", () => {
    const answer = answerStatisticalQuestion("When should I use LSD instead of Tukey?");
    expect(answer?.title).toMatch(/LSD versus Tukey/);
    expect(answer?.paragraphs.join(" ")).toMatch(/family-wise error rate/);
    expect(answer?.paragraphs.join(" ")).not.toMatch(/Upload or select/);
  });
  it("explains experimental CV%, its formula and the difference from descriptive CV", () => {
    const answer = answerStatisticalQuestion("What does CV% tell me in an ANOVA?");
    expect(answer?.paragraphs.join(" ")).toContain("√MSE");
    expect(answer?.paragraphs.join(" ")).toContain("descriptive CV%");
  });
  it("does not invent an HSD critical value", () => {
    expect(answerStatisticalQuestion("What is Tukey HSD?")?.paragraphs.join(" ")).toContain("should be reported only");
  });
  it("explains correlation and small-sample safeguards", () => {
    expect(answerStatisticalQuestion("When to use Pearson versus Spearman?")?.paragraphs.join(" ")).toContain("10 or fewer");
  });
  it("uses a fail-closed path for unknown statistics questions", () => {
    expect(answerStatisticalQuestion("How do I estimate BLUP in a mixed model?")).toBeNull();
    expect(isUnansweredStatisticalQuestion("How do I estimate BLUP in a mixed model?")).toBe(true);
  });
  it("keeps ordinary navigation questions separate", () => {
    expect(isUnansweredStatisticalQuestion("How can I upload a CSV file?")).toBe(false);
    expect(answerStatisticalQuestion("How can I upload a CSV file?")).toBeNull();
  });
});
