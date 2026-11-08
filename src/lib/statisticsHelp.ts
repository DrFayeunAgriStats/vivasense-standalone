/** Workshop-safe statistical FAQ; not a language model and not dataset-specific analysis.
 * Questions outside these verified explanations are not sent to upload tutorials. */
export interface VerifiedStatisticsAnswer {
  title: string;
  paragraphs: string[];
  points?: string[];
}
export function answerStatisticalQuestion(question: string): VerifiedStatisticsAnswer | null {
  const q = question.toLowerCase().trim();
  const hasLsd = /\b(lsd|least significant difference)\b/.test(q);
  const hasTukey = /\b(tukey|hsd|honestly significant difference)\b/.test(q);
  if (hasLsd && hasTukey) return {
    title: "LSD versus Tukey HSD",
    paragraphs: [
      "Tukey HSD is commonly preferred when a researcher wants to compare all pairs of treatment means while controlling the family-wise error rate. Unadjusted Fisher's LSD is less protective when many pairwise tests are performed.",
      "LSD can be appropriate for a small number of scientifically preplanned contrasts under a suitable ANOVA model, but it should not be selected merely because it produces more significant letters.",
      "VivaSense's governed one-factor mean separation uses Tukey HSD. It does not silently replace Tukey with LSD."
    ],
    points: ["Check the experimental design and the error term before comparing means.", "Interpret the overall ANOVA and the declared comparison family together.", "For preplanned specific comparisons, seek a validated contrast procedure rather than treating all pairwise LSD tests as automatically justified."]
  };
  if (/\b(cv|coefficient of variation)\b/.test(q)) return {
    title: "What does experimental CV% tell me?",
    paragraphs: [
      "For a standard one-factor CRD or RCBD with a valid residual mean square (MSE) and a positive, nonzero grand mean, experimental CV% = 100 × √MSE / grand mean.",
      "It describes residual variability relative to the response mean, in percent. A smaller CV% may suggest greater experimental precision, but there is no universal cutoff for all crops, traits, scales or environments.",
      "This experimental residual CV% differs from descriptive CV% based on the ordinary sample standard deviation. It is not a p-value and does not establish whether treatments differ."
    ],
    points: ["For split-plot and more complex designs, the relevant error stratum must be specified.", "Never interpret CV% in isolation from the trait, units, design and data quality."]
  };
  if (hasTukey) return {
    title: "Understanding Tukey HSD",
    paragraphs: [
      "Tukey's honestly significant difference procedure compares treatment means while accounting for multiple pairwise comparisons within the defined family.",
      "Means sharing a Tukey grouping letter are not detected as different at the reported significance level. Different letters reflect the model and comparison method, not evidence of a causal biological mechanism.",
      "A numerical HSD threshold should be reported only if the validated analysis actually provides one; grouping letters alone do not justify inventing an HSD value."
    ]
  };
  if (/\b(pearson|spearman)\b/.test(q)) return {
    title: "Pearson or Spearman correlation?",
    paragraphs: [
      "Pearson's r describes linear association between measured numerical variables. Spearman's ρ describes monotonic rank association and can be more appropriate when the relation is not linear or is influenced by extreme observations.",
      "General Correlation does not model blocks, genotype effects, clustering or repeated observations. Ordinary correlation is neither a genetic correlation nor a design-adjusted association.",
      "Small-sample Spearman p-values are withheld for pairs with 10 or fewer complete observations under the current VivaSense early-access policy."
    ]
  };
  if (/\b(fdr|benjamini|multiple testing|adjusted p|false discovery)\b/.test(q)) return {
    title: "Why are p-values adjusted?",
    paragraphs: [
      "When many correlations or comparisons are tested, apparently small p-values occur more often by chance. VivaSense General Correlation reports both raw p-values and Benjamini–Hochberg FDR-adjusted values.",
      "Its significance decisions use the adjusted p-value. FDR adjustment is an exploratory procedure whose error-control guarantees depend on assumptions about dependence among tests.",
      "Statistical significance does not by itself establish biological or agronomic importance."
    ]
  };
  if (/\b(anova|analysis of variance)\b/.test(q) && /\b(what|why|explain|interpret|f.?test|variance|mean square)\b/.test(q)) return {
    title: "Understanding ANOVA",
    paragraphs: [
      "ANOVA separates variation attributable to defined model effects from an appropriate error term. The F statistic compares mean squares, and its p-value is interpreted conditionally on the design and model assumptions.",
      "A significant omnibus F-test indicates evidence against equality of the tested effects; it does not identify every pair of treatment means. Use an appropriate, declared comparison method where needed.",
      "For RCBD, factorial and split-plot experiments, preserve the intended design structure and use the correct denominator and error stratum."
    ]
  };
  if (/\b(outlier|cooks? distance|normality|qq plot|q-q|residual plot|homogeneity)\b/.test(q)) return {
    title: "How should I use diagnostics?",
    paragraphs: [
      "Residual-versus-fitted and Q–Q plots can help assess model fit and distributional assumptions. A flagged observation or Cook's distance threshold is a screening prompt, not proof that a value is wrong.",
      "VivaSense must not automatically remove data, transform outcomes or claim an assumption passes solely from a non-significant diagnostic test. Review the experimental record and model before acting."
    ]
  };
  return null;
}

export function isUnansweredStatisticalQuestion(question: string): boolean {
  return /\b(what|why|how|when|should|explain|calculate|interpret|difference|meaning|mean|formula)\b/i.test(question)
    && /\b(anova|statistics?|statistical|lsd|tukey|hsd|cv|variance|p.value|f.test|correlat\w*|normality|heritability|regression|blup|mean separation|experimental design)\b/i.test(question)
    && answerStatisticalQuestion(question) === null;
}
