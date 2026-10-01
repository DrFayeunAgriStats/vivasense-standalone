export type TutorialCategory =
  | "Getting Started"
  | "Experimental Design & ANOVA"
  | "Field Layout"
  | "Data Capture"
  | "Reports & Saved Analyses"
  | "Troubleshooting & Support";

export interface TutorialResource {
  label: string;
  href: string;
  description?: string;
  download?: boolean;
}

export interface TutorialSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  example?: string[];
  note?: string;
  resources?: TutorialResource[];
}

export interface Tutorial {
  slug: string;
  title: string;
  category: TutorialCategory;
  description: string;
  keywords: string[];
  sections: TutorialSection[];
  actionPath?: string;
  actionHref?: string;
  actionLabel?: string;
}

const commonAnalysisSteps = [
  "Open Experimental Design & ANOVA.",
  "Choose a CSV, XLSX, or XLS file and select Preview Dataset.",
  "Review the detected columns. The upload-stage Treatment / Factor Hint is optional; exact design roles are mapped after the dataset is prepared.",
  "Use Replication / Block only for a true block or replication factor. Leave Environment as None for a single-environment trial.",
  "Confirm Mapping & Prepare Dataset.",
  "Choose the design that matches how the experiment was randomized.",
  "Map the design-specific roles, select one or more response variables, and choose inferential α = 0.01, 0.05, or 0.10.",
  "Review the design summary, run the analysis, interpret the ANOVA before mean separation, and download the Word report."
];

const templateResources: TutorialResource[] = [
  { label: "CRD CSV template", href: "/templates/vivasense-crd-template.csv", description: "One treatment factor; opens in Excel.", download: true },
  { label: "RCBD CSV template", href: "/templates/vivasense-rcbd-template.csv", description: "Treatment × complete block layout.", download: true },
  { label: "Factorial CRD CSV template", href: "/templates/vivasense-factorial-crd-template.csv", description: "Two crossed factors with repeated observations.", download: true },
  { label: "Factorial RCBD CSV template", href: "/templates/vivasense-factorial-rcbd-template.csv", description: "Two crossed factors within complete blocks.", download: true },
  { label: "Split-Plot RCBD CSV template", href: "/templates/vivasense-split-plot-rcbd-template.csv", description: "Block × whole-plot × subplot structure.", download: true },
];

export const gettingStartedTutorials: Tutorial[] = [
  {
    slug: "start-here",
    title: "Start Here — VivaSense in 5 Minutes",
    category: "Getting Started",
    description: "The shortest path from a field-trial spreadsheet to an ANOVA result and Word report.",
    keywords: ["start", "first analysis", "workflow", "upload", "excel", "anova", "report", "early access", "preview", "session"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open Experimental Design & ANOVA",
    sections: [
      {
        title: "What the release labels mean",
        bullets: [
          "Early Access means the workflow is available for real research use and user testing, but feedback and defects may still be found and corrected.",
          "CRD and RCBD are marked Early Access.",
          "Factorial CRD, Factorial RCBD, and Split-Plot RCBD are marked Preview · session-only.",
          "Session-only means the full result lives in the current analysis state and is not a durable reopenable AnalysisRun. Reloading, signing out, closing the tab, or leaving the workflow may make it unavailable.",
          "For every Preview analysis, download the Word report before leaving the session.",
          "RCBD is the current durable AnalysisRun pathway and can be reopened from a saved analysis record."
        ]
      },
      { title: "The basic workflow", bullets: commonAnalysisSteps },
      {
        title: "If you are unsure",
        bullets: [
          "Use Prepare Your Dataset before uploading your own spreadsheet.",
          "Use Choose the Correct Experimental Design before selecting CRD, RCBD, Factorial, or Split-Plot.",
          "If an analysis stops, read the visible error and open Troubleshooting & Support instead of changing columns at random."
        ],
        note: "A release label describes workflow maturity. It does not replace statistical judgment about whether the chosen design matches the experiment."
      }
    ]
  },
  {
    slug: "prepare-dataset",
    title: "Prepare Your Excel or CSV Dataset",
    category: "Getting Started",
    description: "Set up the spreadsheet, understand every upload mapping box, and use a design template.",
    keywords: ["dataset", "csv", "excel", "xlsx", "sheet", "header", "columns", "rows", "format", "missing", "units", "mapping", "environment", "location", "year"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Go to Dataset Upload",
    sections: [
      {
        title: "Spreadsheet rules that prevent most upload problems",
        bullets: [
          "Put column names in row 1. Do not place a title, note, or blank row above the headers.",
          "For Excel files, place the analysis table on the first worksheet. VivaSense currently reads the first worksheet by default.",
          "Use one row for one experimental observation or plot record.",
          "Keep structural variables and response variables in separate columns. Do not merge cells.",
          "Do not add totals, subtotals, treatment means, or ANOVA calculations beneath the raw observations.",
          "Keep treatment and factor labels consistent; T1, t1, and Treatment 1 are different text values unless you standardize them.",
          "Do not leave treatment, factor, whole-plot, subplot, or block identifiers blank.",
          "Keep measured response columns numeric. Put units in the column name, for example plant_height_cm or yield_t_ha, rather than typing units inside numeric cells.",
          "If a response was genuinely not observed, leave that response cell blank rather than entering an invented zero. A missing response can still make a complete design structurally incomplete, so inspect any warning or rejection."
        ]
      },
      {
        title: "What the upload mapping boxes mean",
        bullets: [
          "Treatment / Factor Hint: optional at upload. For CRD or RCBD you can select the treatment column now. For Factorial and Split-Plot you may leave it blank; the exact Factor A/B or whole-plot/subplot roles are mapped in the next step.",
          "Replication / Block Column: select the column that identifies real blocks or replications. Choose None for CRD.",
          "Environment Column: use a single column whose levels already identify environments. Leave it as None for a single-environment trial.",
          "Mode: choose Single Environment for one site/season environment. Multi-Environment is for data that truly contain two or more environments.",
          "Location Column + Year / Season Column: use both only when you have no single Environment column and environments should be constructed from Location × Year/Season. If an Environment column is already selected, these fields are not used."
        ],
        note: "The upload mapping prepares the dataset. The design card below it is authoritative for CRD/RCBD treatment, Factor A/B, or Split-Plot whole-plot/subplot roles."
      },
      {
        title: "Design-specific role mapping after upload",
        bullets: [
          "CRD: Treatment / Factor = the treatment column; no block role.",
          "RCBD: Treatment / Factor = treatment; Replication / Block = block or rep.",
          "Factorial CRD: Factor A and Factor B are the two crossed factors. No block is fitted.",
          "Factorial RCBD: Factor A + Factor B + Replication / Block.",
          "Split-Plot RCBD: Replication / Block + Whole-Plot Factor + Subplot Factor. Do not map the whole-plot factor again as a generic treatment."
        ]
      },
      {
        title: "Download a clean starting template",
        paragraphs: [
          "These CSV files open directly in Excel. Replace the example labels and values with your own observations while keeping one row per observation."
        ],
        resources: templateResources
      },
      {
        title: "Simple RCBD example",
        example: [
          "treatment,rep,yield_t_ha",
          "T1,B1,3.8",
          "T2,B1,4.4",
          "T3,B1,4.1",
          "T1,B2,4.0",
          "T2,B2,4.6",
          "T3,B2,4.2",
          "T1,B3,3.9",
          "T2,B3,4.5",
          "T3,B3,4.3"
        ]
      }
    ]
  },
  {
    slug: "choose-design",
    title: "Choose the Correct Experimental Design",
    category: "Getting Started",
    description: "Choose from the randomization structure of the experiment, not from the appearance of the spreadsheet.",
    keywords: ["crd", "rcbd", "factorial", "split plot", "split-plot", "design choice", "randomization", "irrigation", "variety"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Choose a Design",
    sections: [
      {
        title: "Quick decision guide",
        bullets: [
          "CRD: one treatment factor, with experimental units assigned without blocks.",
          "RCBD: one treatment factor arranged in complete blocks.",
          "Factorial CRD: two crossed treatment factors randomized at the same experimental-unit level, without blocks.",
          "Factorial RCBD: two crossed treatment factors randomized at the same experimental-unit level within complete blocks.",
          "Split-Plot RCBD: randomization occurs in two stages—one factor is assigned to whole plots inside blocks, then another factor is randomized to subplots inside each whole plot."
        ]
      },
      {
        title: "The field example that separates Factorial RCBD from Split-Plot",
        paragraphs: [
          "Suppose irrigation is applied to large plots because irrigation cannot practically be changed plant by plant, and several varieties are then randomized inside each irrigated plot. Irrigation is the whole-plot factor and variety is the subplot factor.",
          "That is Split-Plot RCBD, not Factorial RCBD, because the two factors were randomized at different experimental-unit levels."
        ]
      },
      {
        title: "Do not infer the design from column counts",
        paragraphs: [
          "The same table can be rearranged to resemble more than one design. What matters is how the experiment was randomized and which experimental unit received each factor.",
          "A replication column does not automatically make an experiment RCBD, and repeated observations do not automatically create blocks."
        ],
        note: "If the design cannot be established confidently, return to the field protocol or randomization plan. Do not choose a model by trial and error."
      }
    ]
  },
  {
    slug: "run-analysis",
    title: "Run an Analysis Step by Step",
    category: "Getting Started",
    description: "A screen-by-screen guide that matches the current Experimental Design & ANOVA workflow.",
    keywords: ["run", "analysis", "upload", "mapping", "mode", "location", "year", "alpha", "word report", "error"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Run an Analysis",
    sections: [
      { title: "1. Upload and preview", bullets: commonAnalysisSteps.slice(0, 5) },
      {
        title: "2. Choose and map the design",
        bullets: [
          "Choose CRD, RCBD, Factorial CRD, Factorial RCBD, or Split-Plot RCBD.",
          "For Factorial designs, map Factor A and Factor B in the design card. The upload-stage Treatment / Factor Hint is not the authoritative factorial mapping.",
          "For Split-Plot, map Replication / Block, Whole-Plot Factor, and Subplot Factor. The generic treatment hint is not part of the Split-Plot model.",
          "A structural column already used for another active role is removed from competing role selectors.",
          "Read the design summary before analysis. It describes your mapping; the backend checks the full data structure."
        ]
      },
      {
        title: "3. Select response variables and alpha",
        bullets: [
          "Choose one or more numeric response variables.",
          "Run Analysis remains unavailable until all required roles and at least one response variable are selected.",
          "Choose inferential α = 0.01, 0.05, or 0.10.",
          "Inferential alpha governs significance decisions and governed mean-comparison wording. Assumption diagnostics use the fixed diagnostic α = 0.05."
        ]
      },
      {
        title: "4. Run, inspect, and export",
        bullets: [
          "Select Run Analysis and wait for the result or a visible error message.",
          "If the design is rejected, correct the mapping or dataset rather than trying to bypass the guard.",
          "Read the ANOVA result before interpreting Tukey or other mean-separation letters.",
          "Download the Word report while the result is available; this is essential for Preview designs."
        ],
        resources: [
          { label: "Troubleshooting & Support", href: "/help/troubleshooting", description: "Use the exact on-screen error to find the next step." }
        ]
      }
    ]
  },
  {
    slug: "understand-results",
    title: "Understand Your ANOVA Results",
    category: "Getting Started",
    description: "Read the ANOVA table, Tukey HSD, CV, diagnostics, and interpretation without overclaiming.",
    keywords: ["anova table", "source", "df", "ss", "ms", "f value", "p value", "tukey", "means", "letters", "cv", "diagnostics", "shapiro", "qq", "cook"],
    sections: [
      {
        title: "Read the ANOVA table from left to right",
        bullets: [
          "Source or Effect identifies the model term being tested, such as treatment, block, Factor A, Factor B, or A × B.",
          "df is degrees of freedom associated with that source.",
          "SS is the sum of squares attributed to that source under the fitted model and design.",
          "MS is mean square, usually SS divided by its df.",
          "F is the test statistic formed from the effect mean square and its design-appropriate denominator.",
          "p-value is compared with your selected inferential alpha. A p-value at or below alpha is treated as statistically significant under the governed decision rule."
        ]
      },
      {
        title: "Mean separation and Tukey HSD",
        bullets: [
          "Tukey HSD is a multiple-comparison procedure used where the governed result calls for it.",
          "Levels sharing a grouping letter are not separated by that displayed procedure at the selected alpha.",
          "Levels with no letter in common are separated by that procedure.",
          "Grouping letters are not a universal ranking of biological quality.",
          "For factorial experiments, when the interaction governs, use the simple-effects results to answer how one factor behaves within levels of the other."
        ]
      },
      {
        title: "CV and diagnostics",
        bullets: [
          "CV expresses residual variability relative to the mean. Its agronomic interpretation depends on the trait, crop, scale, and experiment; there is no single universal good/bad cutoff for every trait.",
          "Shapiro-Wilk is a residual normality diagnostic where shown. Its p-value is diagnostic evidence, not proof that residuals are or are not perfectly normal.",
          "The Q-Q plot lets you inspect how closely residual quantiles follow a reference line; strong systematic departures deserve investigation.",
          "Cook's distance identifies observations that may have unusual influence on a fitted model. VivaSense reports the raw Cook's D; 4/n is a screening threshold for review, not an automatic deletion rule.",
          "Do not delete an observation merely because a diagnostic flag appears. Check data entry, field notes, biological plausibility, and the experimental context first."
        ]
      },
      {
        title: "Split-Plot and factorial interpretation",
        bullets: [
          "For Split-Plot RCBD, the whole-plot factor is tested against whole-plot error (Error A); the subplot factor and interaction use subplot error (Error B).",
          "For Factorial designs, interpret an important interaction before relying on marginal main-effect comparisons."
        ]
      },
      {
        title: "Keep statistical and biological conclusions separate",
        note: "A statistically significant effect is evidence about the fitted model; it does not by itself establish agronomic importance. The researcher still judges biological meaning, effect size, feasibility, and consistency with the objective."
      }
    ]
  }
];

export const analysisTutorials: Tutorial[] = [
  {
    slug: "crd",
    title: "CRD — Completely Randomized Design",
    category: "Experimental Design & ANOVA",
    description: "One treatment factor without a blocking structure.",
    keywords: ["crd", "completely randomized", "one factor", "anova", "template"],
    actionPath: "/workspace?module=anova&design=crd",
    actionLabel: "Open CRD Analysis",
    sections: [
      { title: "When to use CRD", paragraphs: ["Use CRD when experimental units are sufficiently homogeneous for the planned randomization and there is one treatment factor without a block term."] },
      { title: "Map these roles", bullets: ["Treatment / Factor = treatment column.", "Replication / Block is not fitted.", "Select at least one numeric response variable."] },
      {
        title: "Worked data shape",
        example: [
          "treatment,yield_t_ha",
          "T1,3.8", "T1,4.0", "T1,3.9",
          "T2,4.4", "T2,4.6", "T2,4.5",
          "T3,4.1", "T3,4.2", "T3,4.3"
        ],
        resources: [{ label: "Download CRD template", href: "/templates/vivasense-crd-template.csv", download: true }]
      },
      { title: "Run it in VivaSense", bullets: commonAnalysisSteps }
    ]
  },
  {
    slug: "rcbd",
    title: "RCBD — Randomized Complete Block Design",
    category: "Experimental Design & ANOVA",
    description: "One treatment factor arranged in complete blocks or replications.",
    keywords: ["rcbd", "block", "replication", "complete block", "anova", "template"],
    actionPath: "/workspace?module=anova&design=rcbd",
    actionLabel: "Open RCBD Analysis",
    sections: [
      { title: "When to use RCBD", paragraphs: ["Use RCBD when each block contains every treatment once and blocks account for a known source of experimental-unit heterogeneity."] },
      { title: "Map these roles", bullets: ["Treatment / Factor = treatment column.", "Replication / Block = block or rep column.", "Select at least one numeric response variable.", "Every treatment should occur in every block for the governed complete-block workflow."] },
      {
        title: "Worked data shape",
        example: [
          "treatment,rep,yield_t_ha",
          "T1,B1,3.8", "T2,B1,4.4", "T3,B1,4.1",
          "T1,B2,4.0", "T2,B2,4.6", "T3,B2,4.2",
          "T1,B3,3.9", "T2,B3,4.5", "T3,B3,4.3"
        ],
        resources: [{ label: "Download RCBD template", href: "/templates/vivasense-rcbd-template.csv", download: true }]
      },
      { title: "Persistence and reports", paragraphs: ["RCBD currently uses VivaSense's durable AnalysisRun pathway. A completed persistent RCBD can be reopened from history and its Word report downloaded from that exact stored analysis."] }
    ]
  },
  {
    slug: "factorial-crd",
    title: "Factorial CRD",
    category: "Experimental Design & ANOVA",
    description: "Two crossed treatment factors randomized at the same level, without blocks.",
    keywords: ["factorial crd", "factor a", "factor b", "interaction", "split plot", "template"],
    actionPath: "/workspace?module=anova&design=factorial_crd",
    actionLabel: "Open Factorial CRD",
    sections: [
      { title: "When to use it", paragraphs: ["Use Factorial CRD when two factors are crossed and both are randomized at the same experimental-unit level without blocks. If one factor was applied to whole plots and the other within those plots, use Split-Plot RCBD instead."] },
      { title: "Map these roles", bullets: ["At the upload step, the Treatment / Factor Hint may be left blank.", "Factor A = first crossed factor.", "Factor B = second crossed factor.", "No Replication / Block term is fitted in the Factorial CRD model.", "Select at least one numeric response variable."] },
      {
        title: "Worked data shape with replication",
        example: [
          "nitrogen,variety,yield_t_ha",
          "N0,V1,3.1", "N0,V1,3.3", "N0,V2,3.4", "N0,V2,3.5",
          "N60,V1,4.1", "N60,V1,4.0", "N60,V2,4.5", "N60,V2,4.6"
        ],
        resources: [{ label: "Download Factorial CRD template", href: "/templates/vivasense-factorial-crd-template.csv", download: true }]
      },
      { title: "Interpret interaction first", paragraphs: ["When A × B governs, the effect of one factor depends on the level of the other. Use governed simple effects for inference rather than treating marginal means as the whole story."], note: "Factorial CRD is Preview · session-only. Download the Word report before leaving the session." }
    ]
  },
  {
    slug: "factorial-rcbd",
    title: "Factorial RCBD",
    category: "Experimental Design & ANOVA",
    description: "Two crossed factors randomized at the same level within complete blocks.",
    keywords: ["factorial rcbd", "factor a", "factor b", "block", "interaction", "split plot", "template"],
    actionPath: "/workspace?module=anova&design=factorial_rcbd",
    actionLabel: "Open Factorial RCBD",
    sections: [
      { title: "When to use it", paragraphs: ["Use Factorial RCBD when two factors are crossed, both are randomized at the same experimental-unit level, and every A × B combination occurs in every block. If one factor was applied to whole plots before the second factor was randomized inside them, use Split-Plot RCBD instead."] },
      { title: "Map these roles", bullets: ["At the upload step, the Treatment / Factor Hint may be left blank.", "Factor A = first crossed factor.", "Factor B = second crossed factor.", "Replication / Block = block column.", "Select at least one numeric response variable."] },
      {
        title: "Worked complete-block shape",
        example: [
          "nitrogen,variety,rep,yield_t_ha",
          "N0,V1,R1,3.1", "N0,V2,R1,3.5", "N60,V1,R1,4.1", "N60,V2,R1,4.6",
          "N0,V1,R2,3.2", "N0,V2,R2,3.4", "N60,V1,R2,4.0", "N60,V2,R2,4.5",
          "N0,V1,R3,3.0", "N0,V2,R3,3.6", "N60,V1,R3,4.2", "N60,V2,R3,4.7"
        ],
        resources: [{ label: "Download Factorial RCBD template", href: "/templates/vivasense-factorial-rcbd-template.csv", download: true }]
      },
      { title: "Interpretation", paragraphs: ["Interpret the interaction before treating marginal Factor A or Factor B comparisons as the main conclusion when the interaction governs."], note: "Factorial RCBD is Preview · session-only. Download the Word report before leaving the session." }
    ]
  },
  {
    slug: "split-plot-rcbd",
    title: "Split-Plot RCBD",
    category: "Experimental Design & ANOVA",
    description: "Two-stage randomization with a whole-plot factor and a subplot factor.",
    keywords: ["split plot", "split-plot", "whole plot", "subplot", "error a", "error b", "irrigation", "variety", "template"],
    actionPath: "/workspace?module=anova&design=split_plot_rcbd",
    actionLabel: "Open Split-Plot RCBD",
    sections: [
      { title: "When to use it", paragraphs: ["Use Split-Plot RCBD when randomization occurs in two stages: the main-plot factor is assigned to whole plots inside blocks, then the subplot factor is assigned within each whole plot. Example: irrigation on large plots, with varieties randomized inside each irrigated plot."] },
      { title: "Map these roles", bullets: ["At upload, the generic Treatment / Factor Hint may be left blank.", "Replication / Block = block or rep.", "Whole-Plot Factor = factor assigned to the large whole plots.", "Subplot Factor = factor randomized inside each whole plot.", "Select at least one numeric response variable."] },
      {
        title: "Worked complete example",
        example: [
          "rep,irrigation,variety,yield_t_ha",
          "R1,I1,V1,3.1", "R1,I1,V2,3.4", "R1,I2,V1,4.0", "R1,I2,V2,4.5",
          "R2,I1,V1,3.2", "R2,I1,V2,3.5", "R2,I2,V1,4.1", "R2,I2,V2,4.6",
          "R3,I1,V1,3.0", "R3,I1,V2,3.3", "R3,I2,V1,4.2", "R3,I2,V2,4.7"
        ],
        resources: [{ label: "Download Split-Plot RCBD template", href: "/templates/vivasense-split-plot-rcbd-template.csv", download: true }]
      },
      { title: "Respect the two error strata", paragraphs: ["The whole-plot factor is evaluated against whole-plot variability (Error A). The subplot factor and whole-plot × subplot interaction are evaluated against subplot variability (Error B). Do not replace this with one pooled residual error."], note: "Split-Plot RCBD is Preview · session-only. Download the Word report before leaving the session." }
    ]
  },
  {
    slug: "mean-separation",
    title: "Mean Separation and Grouping Letters",
    category: "Experimental Design & ANOVA",
    description: "Understand Tukey HSD and other displayed post-ANOVA comparisons.",
    keywords: ["mean separation", "tukey", "tukey hsd", "lsd", "groups", "letters"],
    sections: [
      { title: "Why mean separation follows ANOVA", paragraphs: ["ANOVA tests whether the fitted model provides evidence of an effect. A governed mean-comparison procedure then identifies which displayed levels are separated under its stated rule."] },
      { title: "How to read Tukey HSD letters", bullets: ["Levels sharing a letter are not separated by that displayed Tukey HSD procedure at the selected alpha.", "Levels with no letter in common are separated by that procedure.", "Grouping depends on the selected alpha and the stated comparison method.", "Letters should not be read as a universal biological ranking."] },
      { title: "Factorial caution", note: "When an interaction governs, interpret simple effects in the interaction context. Do not use a marginal or all-cell table to erase the interaction structure." }
    ]
  }
];

export const fieldLayoutTutorials: Tutorial[] = [
  {
    slug: "field-layout",
    title: "Generate a Field Layout and Field Book",
    category: "Field Layout",
    description: "Randomise treatments, inspect the layout, and export materials for field work.",
    keywords: ["field layout", "randomization", "field book", "plots", "seed", "export"],
    actionPath: "/workspace?module=field-layout",
    actionLabel: "Open Field Layout",
    sections: [
      { title: "Set up the layout", bullets: ["Open Field Layout from navigation.", "Choose the offered design.", "Enter treatment labels and the requested number of replications.", "Enter plot dimensions and alley width when you want those values in the physical-layout summary.", "Keep or change the randomization seed. Reusing the same seed with the same inputs reproduces the intended randomization."] },
      { title: "Generate and inspect", paragraphs: ["Select Generate, then inspect treatment labels, plot numbers, replication/block structure, and total plot count before using the layout in the field."] },
      { title: "Export for field work", bullets: ["Download the field-book spreadsheet for data collection.", "Download CSV for a plain tabular file.", "Download the field-layout image when you need a visual field map."] }
    ]
  }
];

export const dataCaptureTutorials: Tutorial[] = [
  {
    slug: "data-capture",
    title: "Create a Study and Capture Field Data",
    category: "Data Capture",
    description: "Set up a study, define traits, move plot by plot, and review data before analysis.",
    keywords: ["data capture", "study", "fieldbook", "traits", "gps", "photos", "notes"],
    actionPath: "/data-capture",
    actionLabel: "Open Data Capture",
    sections: [
      { title: "Create a study", bullets: ["Open Data Capture and select New study.", "Enter the study title; researcher, location, and crop are optional descriptive fields.", "Choose the supported study design.", "Enter treatment labels and the requested replications.", "Define at least one trait to collect."] },
      { title: "Define useful trait rules", bullets: ["Trait types include numeric, integer, decimal, dropdown, text, yes/no, date, GPS, and photo.", "For numeric traits, store a unit and optional minimum/maximum limits.", "Mark a trait Required when a plot should not be complete without it.", "For dropdown traits, define the allowed options in advance."] },
      { title: "Collect and review", paragraphs: ["Open the fieldbook, choose a plot, enter trait values, and move plot by plot while watching save status. Photos, GPS, and field notes can be recorded where available.", "Use Validate & Analyze to review collected data before analysis. Resolve obvious missing or invalid observations before treating the dataset as analysis-ready."] }
    ]
  }
];

export const reportTutorials: Tutorial[] = [
  {
    slug: "reports-and-saved-analyses",
    title: "Reports and Saved Analyses",
    category: "Reports & Saved Analyses",
    description: "Know what is durable, what is session-only, and when to download immediately.",
    keywords: ["report", "word", "download", "persistent", "saved", "history", "preview", "session", "reopen"],
    sections: [
      { title: "Word reports", paragraphs: ["Supported ANOVA results provide a Word-report download. The report belongs to the analysis that produced it. If VivaSense says the exact analysis identity is no longer available, rerun instead of reconstructing a report from a different result."] },
      { title: "Persistent RCBD", paragraphs: ["RCBD currently uses the durable AnalysisRun pathway. Its saved history record can reopen the completed run and download the report associated with that exact stored analysis."] },
      { title: "CRD Early Access", paragraphs: ["CRD is available as an Early Access analysis with Word-report download. The current durable reopen workflow is specifically RCBD, so retain the CRD report you need for your records."] },
      { title: "What session-only means", bullets: ["Factorial CRD, Factorial RCBD, and Split-Plot RCBD are session-only Preview workflows.", "Their history rows can record that a run occurred, but that does not make the full result durable or reopenable.", "Download the Word report before reloading, signing out, closing the tab, or leaving the analysis workflow."] }
    ]
  }
];

export const supportTutorials: Tutorial[] = [
  {
    slug: "troubleshooting",
    title: "Troubleshooting & Report a Problem",
    category: "Troubleshooting & Support",
    description: "Use the on-screen error to correct the dataset or mapping, or send a useful support report.",
    keywords: ["error", "failed", "failure", "missing", "feedback", "support", "report problem", "not in index", "mapped as both", "timeout", "incomplete", "duplicate"],
    actionHref: "mailto:support@vivasense.app?subject=VivaSense%20Early%20Access%20problem",
    actionLabel: "Email VivaSense Support",
    sections: [
      {
        title: "First: copy the exact error",
        paragraphs: ["Analysis failures are now shown on the page. Keep the exact text; it is more useful than saying only that the analysis did not work."],
        bullets: ["Do not change several mappings at once just to make the error disappear.", "Confirm the current dataset name and selected response variable.", "Confirm the design and every structural role before rerunning."]
      },
      {
        title: "Common messages and what to do",
        bullets: [
          "“Column 'X' is mapped as both …”: the same column has two experimental roles. Assign distinct columns that match the real randomization structure.",
          "“Trait 'X' … not in index”: the requested response column is not present in the dataset being analysed. Re-preview the current file and reselect the response variable; check for renamed headers.",
          "Incomplete or missing-cell errors: at least one required treatment/factor combination is absent after usable responses are considered. Check the raw rows and missing responses.",
          "Duplicated-cell errors: a design cell that should occur once within its block/whole-plot structure occurs more than once. Check identifiers and duplicated rows.",
          "Missing structural identifier: a treatment, factor, block, whole-plot, or subplot label is blank in at least one required row.",
          "Network or timeout error: keep the dataset unchanged, check the connection, and retry once. If it repeats, report the time and exact message.",
          "Report identity / persistent report unavailable: do not substitute a different cached result. Reopen the exact durable RCBD run where available or rerun the analysis."
        ]
      },
      {
        title: "What to include when reporting a problem",
        bullets: [
          "Approximate date and time of the failure.",
          "Dataset filename (you do not need to attach the raw data initially).",
          "Selected design.",
          "Every mapped structural column.",
          "Selected response variable(s) and alpha.",
          "The exact on-screen error text.",
          "A screenshot of the mapping/result area if possible.",
          "Browser/device if the problem appears to be visual or navigation-related."
        ],
        note: "Use support@vivasense.app for VivaSense product support. If your dataset is unpublished or sensitive, do not email the raw file by default; start with the error, screenshot, and structure, then share data only if necessary and appropriate."
      }
    ]
  }
];

export const allTutorials = [
  ...gettingStartedTutorials,
  ...analysisTutorials,
  ...fieldLayoutTutorials,
  ...dataCaptureTutorials,
  ...reportTutorials,
  ...supportTutorials
];

export const tutorialCategories: TutorialCategory[] = [
  "Getting Started",
  "Experimental Design & ANOVA",
  "Field Layout",
  "Data Capture",
  "Reports & Saved Analyses",
  "Troubleshooting & Support"
];
