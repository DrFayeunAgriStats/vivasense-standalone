/**
 * REL-UI-01 scientific safeguards — the exact wording shown on the General
 * Correlation page. Identical to the verified Word report
 * (vivasense-backend genetics-module/general_relationship_export.py).
 * Presentation only: no statistical computation depends on these texts.
 */

export const SCOPE_CAUTION =
  "Pearson and Spearman coefficients describe ordinary associations between the observed values. This analysis does not model the experimental design, blocks, genotypes, clustering or repeated measurements: every row is treated as a separate, independent observation. When observations are dependent (for example, plots in the same block, repeated measurements on the same unit, or several plots of the same genotype), conventional p-values may be unreliable and should be interpreted with caution. These results are not genetic correlations and are not adjusted for the experimental design.";

export const SPEARMAN_APPROXIMATION_NOTE =
  "Spearman p-values, where reported, are approximate: they use a t-distribution approximation and can be unreliable for small samples or with tied values. For pairs with 10 or fewer complete observations, only the Spearman coefficient is reported: p-values and significance decisions are withheld pending validated small-sample inference.";

export const MULTIPLE_TESTING_NOTE =
  "Benjamini–Hochberg false-discovery-rate (FDR) adjustment across inferentially eligible pairs is the declared exploratory default. Its error-control guarantees depend on assumptions about dependence among the tests; correlations that share a variable are not independent. Both raw and FDR-adjusted p-values are reported, and significance is judged on the adjusted p-value. Statistical significance does not by itself establish biological or agronomic importance.";

export const PAIRWISE_MISSING_NOTE =
  "Each pair uses every row in which both variables are observed (pairwise-complete observations), so different pairs may be based on different observations and sample sizes (n is shown for each pair). Pairwise deletion does not guarantee unbiased estimates when values are not missing completely at random.";
