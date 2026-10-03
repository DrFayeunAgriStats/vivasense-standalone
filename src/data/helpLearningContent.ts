export type TutorialCategory =
  | "Getting Started"
  | "Experimental Design & ANOVA"
  | "Field Layout"
  | "Data Capture"
  | "Reports & Saved Analyses";

export interface TutorialSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  example?: string[];
  note?: string;
}

export interface Tutorial {
  slug: string;
  title: string;
  category: TutorialCategory;
  description: string;
  keywords: string[];
  sections: TutorialSection[];
  actionPath?: string;
  actionLabel?: string;
}

const commonAnalysisSteps = [
  "Open Experimental Design from the sidebar.",
  "Choose your CSV, XLSX, or XLS file and select Preview Dataset.",
  "Confirm the detected columns, then map the treatment or factor, replication/block, and environment roles that actually exist in your experiment.",
  "Confirm the mapping and prepare the dataset.",
  "Choose the experimental design that matches how the experiment was randomized.",
  "Select one or more response variables and the inferential significance level (α = 0.01, 0.05, or 0.10).",
  "Review the design summary before you run the analysis.",
  "Run the analysis. The result summary and decision appear first; open “View ANOVA Table & Mean Separation” on the results screen to see the ANOVA table, treatment means and grouping letters. Then download the Word report."
];

export const gettingStartedTutorials: Tutorial[] = [
  {
    slug: "start-here",
    title: "Start Here — VivaSense in 5 Minutes",
    category: "Getting Started",
    description: "The shortest path from a research dataset to an ANOVA result and Word report.",
    keywords: ["start", "first analysis", "workflow", "upload", "anova", "report"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open Experimental Design",
    sections: [
      {
        title: "What VivaSense does in this Early Access release",
        paragraphs: [
          "VivaSense helps agricultural researchers move from experimental data to a governed analysis, interpretation, and downloadable report.",
          "The Early Access analysis screen currently supports CRD and RCBD, plus Factorial CRD, Factorial RCBD, and Split-Plot RCBD as Preview workflows."
        ]
      },
      {
        title: "The basic workflow",
        bullets: commonAnalysisSteps
      },
      {
        title: "Know the release labels",
        bullets: [
          "CRD and RCBD are marked Early Access.",
          "Factorial CRD, Factorial RCBD, and Split-Plot RCBD are marked Preview · session-only.",
          "For Preview analyses, download the Word report before leaving the session.",
          "RCBD is the current durable/persistent AnalysisRun pathway and can be reopened from a saved analysis record."
        ],
        note: "A release label describes workflow maturity. It does not replace statistical judgment about whether the chosen design matches the experiment."
      }
    ]
  },
  {
    slug: "prepare-dataset",
    title: "Prepare Your Dataset",
    category: "Getting Started",
    description: "Arrange rows and columns so VivaSense can understand the experimental structure.",
    keywords: ["dataset", "csv", "excel", "columns", "rows", "format"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Go to Dataset Upload",
    sections: [
      {
        title: "One row should represent one experimental observation",
        paragraphs: [
          "Keep structural variables and response variables in separate columns. Do not place several treatment labels or several response variables inside the same cell.",
          "Use clear column names such as treatment, rep, factor_a, factor_b, main_plot, sub_plot, yield, or plant_height. VivaSense lets you map your own names, so the names do not have to match these examples exactly."
        ]
      },
      {
        title: "Before uploading",
        bullets: [
          "Keep treatment and factor labels consistent; for example, do not mix T1, t1, and Treatment 1 unless they truly mean different levels.",
          "Use one replication/block value per row when the design contains blocks.",
          "Keep response variables numeric when they are measurements.",
          "Check for blank structural identifiers such as missing treatment, factor, or replication labels.",
          "Use CSV, XLSX, or XLS files."
        ]
      },
      {
        title: "A simple RCBD shape",
        example: [
          "treatment,rep,yield",
          "T1,B1,10",
          "T1,B2,12",
          "T1,B3,11",
          "T2,B1,14",
          "T2,B2,15",
          "T2,B3,16"
        ],
        note: "The complete dataset must contain every treatment in every block for a complete RCBD."
      }
    ]
  },
  {
    slug: "choose-design",
    title: "Choose the Correct Experimental Design",
    category: "Getting Started",
    description: "Use the randomization structure of the experiment—not the appearance of the data—to choose the model.",
    keywords: ["crd", "rcbd", "factorial", "split plot", "design choice", "randomization"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Choose a Design",
    sections: [
      {
        title: "Quick decision guide",
        bullets: [
          "CRD: one treatment factor, with experimental units assigned without blocks.",
          "RCBD: one treatment factor arranged in complete replication/block groups.",
          "Factorial CRD: two crossed treatment factors, no blocking term.",
          "Factorial RCBD: two crossed treatment factors, with every factor combination represented within every block.",
          "Split-Plot RCBD: blocks contain whole plots receiving the main-plot factor, and each whole plot contains subplots receiving the subplot factor."
        ]
      },
      {
        title: "CRD or RCBD? How the mapping decides",
        bullets: [
          "CRD: set “Replication / Block Column” to None when you upload the dataset. There is no block, so only the treatment column is mapped.",
          "RCBD: set “Replication / Block Column” to the column that identifies each complete block (for example rep or block). Every treatment must appear in every block.",
          "If you choose None for the block, the design opens on CRD. Choosing a block column does not by itself make the experiment an RCBD — only how it was randomized does."
        ]
      },
      {
        title: "Split-Plot or ordinary Factorial?",
        bullets: [
          "Factorial: both factors were applied to the same experimental units, so every combination of A and B was randomized together.",
          "Split-Plot: one factor (the whole-plot factor) was applied to large plots, and the other (the subplot factor) was applied to smaller units inside each whole plot. The two factors are tested against different errors (Error A and Error B).",
          "If a factor is hard to change (for example irrigation applied to a whole plot), the experiment is usually a split-plot, not a factorial."
        ]
      },
      {
        title: "Do not infer design from column counts",
        paragraphs: [
          "The same table can sometimes be rearranged to resemble more than one design. What matters is how the experiment was randomized and which experimental unit received each factor.",
          "A replication column does not automatically make an experiment RCBD, and repeated observations do not automatically create blocks."
        ]
      },
      {
        title: "When unsure",
        note: "Return to the field protocol or randomization plan. If the design cannot be established confidently, do not choose the model by trial and error."
      }
    ]
  },
  {
    slug: "run-analysis",
    title: "Run an Analysis Step by Step",
    category: "Getting Started",
    description: "A screen-by-screen guide to the current Experimental Design & ANOVA workflow.",
    keywords: ["run", "analysis", "upload", "mapping", "alpha", "word report"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Run an Analysis",
    sections: [
      { title: "1. Upload and preview", bullets: commonAnalysisSteps.slice(0, 4) },
      {
        title: "2. Describe the experimental structure",
        bullets: [
          "Choose CRD, RCBD, Factorial CRD, Factorial RCBD, or Split-Plot RCBD.",
          "Map only the roles used by that design. VivaSense will reject impossible mappings such as assigning one column to two structural roles.",
          "Read the design summary before analysis; it is a descriptive check of what you mapped, not a substitute for the backend structure validation."
        ]
      },
      {
        title: "3. Select inference settings",
        bullets: [
          "Choose one or more response variables.",
          "Choose inferential α = 0.01, 0.05, or 0.10.",
          "The selected inferential alpha governs significance decisions and governed mean-comparison wording. Assumption diagnostics use their own fixed diagnostic rule."
        ]
      },
      {
        title: "4. Run, interpret, and export",
        bullets: [
          "Select Run Analysis.",
          "If VivaSense reports a structural error, correct the mapping or dataset rather than trying to bypass it.",
          "While it runs, the button reads “Running analysis…”. When it finishes, the page moves to the results heading.",
          "Where to find the ANOVA table: on the results screen, select “View ANOVA Table & Mean Separation”. It opens the ANOVA table (source, DF, SS, MS, F and p-value), then the treatment means with their grouping letters.",
          "Read the ANOVA table before interpreting mean-separation letters. The replication / block row is shown for completeness; it is not a treatment result.",
          "Download the Word report while the result is available; this is essential for Preview designs."
        ]
      }
    ]
  },
  {
    slug: "understand-results",
    title: "Understand Your ANOVA Results",
    category: "Getting Started",
    description: "Read significance, means, grouping letters, diagnostics, and interpretation without overclaiming.",
    keywords: ["anova table", "p value", "means", "letters", "cv", "diagnostics", "interpretation"],
    sections: [
      {
        title: "Start with the design and ANOVA table",
        bullets: [
          "Confirm that the displayed design is the design you intended to analyse.",
          "For each model effect, compare the reported p-value with the selected inferential alpha.",
          "A statistically significant effect indicates evidence against the corresponding null hypothesis under the fitted model; it does not by itself establish biological importance."
        ]
      },
      {
        title: "Read treatment means and grouping letters carefully",
        bullets: [
          "Mean values describe the observed treatment or factor-level averages.",
          "When a governed mean-comparison procedure is shown, levels sharing a grouping letter are not separated by that procedure at the selected alpha.",
          "Different letters indicate a detected difference under that procedure; the letters are not a ranking of biological value.",
          "For factorial experiments, interaction results take priority when the interaction governs. Simple effects answer how one factor behaves within levels of the other."
        ]
      },
      {
        title: "Diagnostics and CV",
        paragraphs: [
          "Use diagnostics to assess whether model assumptions deserve attention. A warning is a reason to investigate the data and model, not an automatic instruction to delete observations.",
          "The coefficient of variation can help describe residual variability relative to the mean, but its interpretation depends on the trait, crop, scale, and experimental context."
        ]
      },
      {
        title: "Keep statistical and biological conclusions separate",
        note: "VivaSense can support the statistical argument. The researcher still decides whether an effect is agronomically meaningful, practically important, and consistent with the experimental objective."
      }
    ]
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting Your Analysis",
    category: "Getting Started",
    description: "What to do when Run Analysis does not start, your data is refused, or you cannot find the results or report.",
    keywords: ["troubleshooting", "error", "not working", "run analysis", "refused", "incomplete", "text in numeric", "report download", "results"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open Experimental Design",
    sections: [
      {
        title: "Run Analysis does not start",
        bullets: [
          "The Run Analysis button stays disabled until the inputs are complete. Read the red message above it: it names what is missing, for example “Select at least one response variable.”",
          "Choose at least one response variable, and map every column the chosen design needs (treatment or factors, and a block column for RCBD, Factorial RCBD and Split-Plot).",
          "A column cannot play two roles. If one column is mapped as both treatment and block, reassign one of them."
        ]
      },
      {
        title: "VivaSense says the data is incomplete or refused",
        bullets: [
          "Block designs (RCBD, Factorial RCBD, Split-Plot) need every treatment combination in every block, exactly once. The message names the missing or duplicated cell, for example “Treatment TOC-03 × Block R2”.",
          "Correct the source file (add the missing plot or remove the duplicate), then upload it again and rerun. VivaSense will not fill in or guess missing plots in a structured design.",
          "For CRD, blank response cells are excluded and reported (original N, analysed N, which row). That is not the same as an outlier."
        ]
      },
      {
        title: "Text in a numeric response column",
        bullets: [
          "A response column must contain numbers only. If a cell holds text such as “dead” or “missing”, VivaSense names the value, the treatment and the block or row.",
          "Clear that cell, or replace it with the real measurement, in the source file and upload again."
        ]
      },
      {
        title: "I cannot see the results",
        bullets: [
          "After the analysis finishes, the page moves to the results heading. If you scrolled away, look for “ANOVA Results” below the Run Analysis button.",
          "Select “View ANOVA Table & Mean Separation” to open the ANOVA table and the means."
        ]
      },
      {
        title: "The report will not download",
        bullets: [
          "Download the Word report from the results screen while the analysis is still open.",
          "If VivaSense says the analysis identity is no longer available, the service was restarted. Rerun the analysis and download again; a report is never rebuilt from a different result.",
          "Preview designs (Factorial and Split-Plot) cannot be reopened later, so download the report before leaving."
        ]
      },
      {
        title: "Still stuck?",
        paragraphs: [
          "Email support@vivasensestat.com with the file name, the design you chose and the message you saw."
        ]
      }
    ]
  }
];

export const analysisTutorials: Tutorial[] = [
  {
    slug: "crd",
    title: "CRD — Completely Randomized Design",
    category: "Experimental Design & ANOVA",
    description: "Use one treatment factor without a blocking structure.",
    keywords: ["crd", "completely randomized", "one factor", "anova"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open CRD Analysis",
    sections: [
      {
        title: "When to use CRD",
        paragraphs: [
          "Use CRD when experimental units are treated as sufficiently homogeneous for the planned randomization and there is one treatment factor without a block term."
        ]
      },
      {
        title: "Minimum data roles",
        bullets: [
          "Treatment / Factor column.",
          "At least one numeric response variable.",
          "No replication/block column is fitted as a block term in the CRD model."
        ]
      },
      {
        title: "Example data shape",
        example: [
          "treatment,yield",
          "T1,10.2",
          "T1,11.1",
          "T1,10.8",
          "T2,14.0",
          "T2,13.7",
          "T2,14.5"
        ]
      },
      {
        title: "In VivaSense",
        bullets: commonAnalysisSteps
      }
    ]
  },
  {
    slug: "rcbd",
    title: "RCBD — Randomized Complete Block Design",
    category: "Experimental Design & ANOVA",
    description: "Use one treatment factor arranged in complete blocks or replications.",
    keywords: ["rcbd", "block", "replication", "complete block", "anova"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open RCBD Analysis",
    sections: [
      {
        title: "When to use RCBD",
        paragraphs: [
          "Use RCBD when each block contains every treatment once and blocks are used to account for a known source of field or experimental-unit heterogeneity."
        ]
      },
      {
        title: "Minimum data roles",
        bullets: [
          "Treatment / Factor column.",
          "Replication / Block column.",
          "At least one numeric response variable.",
          "Every treatment should occur in every block for the governed complete-block workflow."
        ]
      },
      {
        title: "Example data shape",
        example: [
          "treatment,rep,yield",
          "T1,B1,10",
          "T1,B2,12",
          "T1,B3,11",
          "T2,B1,14",
          "T2,B2,15",
          "T2,B3,16"
        ]
      },
      {
        title: "Persistence and reports",
        paragraphs: [
          "RCBD currently uses VivaSense's durable AnalysisRun pathway. A completed persistent RCBD analysis can be reopened from its saved analysis record and its report can be downloaded from that exact run."
        ]
      }
    ]
  },
  {
    slug: "factorial-crd",
    title: "Factorial CRD",
    category: "Experimental Design & ANOVA",
    description: "Analyse two crossed treatment factors without a block term.",
    keywords: ["factorial crd", "factor a", "factor b", "interaction"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open Factorial CRD",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use Factorial CRD when two treatment factors are crossed, the combinations are assigned without blocks, and the experimental question includes the two main effects and their interaction."
        ]
      },
      {
        title: "Minimum data roles",
        bullets: [
          "Factor A column.",
          "Factor B column.",
          "At least one numeric response variable.",
          "Every Factor A × Factor B combination must be repeated (replicated) at least twice, so the error can be estimated.",
          "Do not map a replication/block column into the Factorial CRD model. The optional replicate-number column is only a label; leave it unmapped."
        ]
      },
      {
        title: "Example data shape and mapping",
        example: [
          "factor_a,factor_b,rep,yield",
          "A1,B1,1,10",
          "A1,B1,2,11",
          "A1,B2,1,12",
          "A1,B2,2,13",
          "A2,B1,1,14",
          "A2,B1,2,15",
          "A2,B2,1,18",
          "A2,B2,2,17"
        ],
        note: "Mapping: Factor A Column = factor_a, Factor B Column = factor_b, response = yield. Each of the four combinations appears twice; the rep column is not mapped as a block."
      },
      {
        title: "Interpret interaction first",
        paragraphs: [
          "When the A × B interaction governs, the effect of one factor depends on the level of the other. Use the governed simple-effects results for inference rather than treating marginal means as the whole story."
        ],
        note: "Factorial CRD is currently a Preview · session-only workflow. Download the Word report before leaving the session."
      }
    ]
  },
  {
    slug: "factorial-rcbd",
    title: "Factorial RCBD",
    category: "Experimental Design & ANOVA",
    description: "Analyse two crossed treatment factors within complete blocks.",
    keywords: ["factorial rcbd", "factor a", "factor b", "block", "interaction"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open Factorial RCBD",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use Factorial RCBD when two factors are crossed and every Factor A × Factor B combination is represented within each block."
        ]
      },
      {
        title: "Minimum data roles",
        bullets: [
          "Factor A column.",
          "Factor B column.",
          "Replication / Block column.",
          "At least one numeric response variable.",
          "Every factor combination should occur exactly once in every block for the governed balanced-complete workflow."
        ]
      },
      {
        title: "Example data shape",
        example: [
          "factor_a,factor_b,rep,yield",
          "A1,B1,R1,10",
          "A1,B2,R1,12",
          "A2,B1,R1,14",
          "A2,B2,R1,18",
          "A1,B1,R2,11",
          "A1,B2,R2,13",
          "A2,B1,R2,15",
          "A2,B2,R2,17"
        ],
        note: "Factorial RCBD is currently a Preview · session-only workflow. Download the Word report before leaving the session."
      }
    ]
  },
  {
    slug: "split-plot-rcbd",
    title: "Split-Plot RCBD",
    category: "Experimental Design & ANOVA",
    description: "Analyse a whole-plot factor and subplot factor with their correct error strata.",
    keywords: ["split plot", "whole plot", "subplot", "error a", "error b"],
    actionPath: "/workspace?module=anova",
    actionLabel: "Open Split-Plot RCBD",
    sections: [
      {
        title: "When to use it",
        paragraphs: [
          "Use Split-Plot RCBD when randomization occurs in two stages: a main-plot factor is assigned to whole plots within blocks, and a subplot factor is assigned within each whole plot."
        ]
      },
      {
        title: "Minimum data roles",
        bullets: [
          "Replication / Block column.",
          "Whole-plot factor column.",
          "Subplot factor column.",
          "At least one numeric response variable."
        ]
      },
      {
        title: "Example data shape",
        example: [
          "rep,main_plot,sub_plot,yield",
          "R1,M1,S1,10",
          "R1,M1,S2,12",
          "R1,M2,S1,14",
          "R1,M2,S2,15",
          "R2,M1,S1,11",
          "R2,M1,S2,13"
        ]
      },
      {
        title: "Respect the two error strata",
        paragraphs: [
          "The whole-plot factor is evaluated against whole-plot variability (Error A). The subplot factor and whole-plot × subplot interaction are evaluated against subplot variability (Error B).",
          "Do not replace this structure with a single pooled residual error when interpreting the split-plot ANOVA."
        ],
        note: "Split-Plot RCBD is currently a Preview · session-only workflow. Download the Word report before leaving the session."
      }
    ]
  },
  {
    slug: "mean-separation",
    title: "Mean Separation and Grouping Letters",
    category: "Experimental Design & ANOVA",
    description: "Understand what post-ANOVA comparison tables do—and what the letters do not mean.",
    keywords: ["mean separation", "tukey", "lsd", "groups", "letters"],
    sections: [
      {
        title: "Why mean separation follows ANOVA",
        paragraphs: [
          "ANOVA tests whether the model provides evidence of an effect. Mean-comparison procedures then help identify which levels are separated under a stated comparison rule."
        ]
      },
      {
        title: "How to read the letters",
        bullets: [
          "Levels sharing a letter are not separated by that displayed procedure at the selected inferential alpha.",
          "Levels with no letter in common are separated by that procedure.",
          "The grouping is tied to the selected alpha and the stated comparison method.",
          "Letters should not be read as a universal biological ranking."
        ]
      },
      {
        title: "Factorial caution",
        note: "When an interaction governs, interpret simple effects in the interaction context. Do not use a marginal or all-cell table to erase the interaction structure."
      }
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
      {
        title: "Set up the layout",
        bullets: [
          "Open Field Layout from the sidebar.",
          "Choose the design offered by the generator.",
          "Enter treatment labels and the number of replications required by the design.",
          "Enter plot dimensions and alley width when you want the physical layout summary to carry those values.",
          "Keep or change the randomization seed. Reusing the same seed with the same inputs makes the intended randomization reproducible."
        ]
      },
      {
        title: "Generate and inspect",
        paragraphs: [
          "Select Generate to create the randomized layout. Inspect treatment labels, plot numbers, replication/block structure, and total plot count before using the layout in the field."
        ]
      },
      {
        title: "Export for field work",
        bullets: [
          "Download the field-book spreadsheet for data collection.",
          "Download CSV when a plain tabular file is more convenient.",
          "Download the field layout image when you need a visual field map."
        ]
      },
      {
        title: "Availability",
        note: "Some field-layout designs are plan-dependent. VivaSense will show availability in the interface rather than silently generating a different design."
      }
    ]
  }
];

export const dataCaptureTutorials: Tutorial[] = [
  {
    slug: "data-capture",
    title: "Create a Study and Capture Field Data",
    category: "Data Capture",
    description: "Set up a CRD or RCBD study, define traits, move plot by plot, and review data before analysis.",
    keywords: ["data capture", "study", "fieldbook", "traits", "gps", "photos", "notes"],
    actionPath: "/data-capture",
    actionLabel: "Open Data Capture",
    sections: [
      {
        title: "Create a study",
        bullets: [
          "Open Data Capture and select New study.",
          "Enter the study title; researcher, location, and crop are optional descriptive fields.",
          "Choose CRD or RCBD in the current study-setup workflow.",
          "Enter treatment labels and at least two replications.",
          "Define at least one trait to collect."
        ]
      },
      {
        title: "Define useful trait rules",
        bullets: [
          "Trait types include numeric, integer, decimal, dropdown, text, yes/no, date, GPS, and photo.",
          "For numeric traits you can store a unit and optional minimum/maximum limits.",
          "Mark a trait Required when the plot should not be considered complete without it.",
          "For dropdown traits, define the allowed options in advance."
        ]
      },
      {
        title: "Collect plot observations",
        paragraphs: [
          "Open the generated fieldbook and choose a plot. Enter trait values, move to the next or previous plot, and watch the save status.",
          "The plot-entry screen also supports photos, GPS capture, and field observations/notes."
        ]
      },
      {
        title: "Review before analysis",
        paragraphs: [
          "Use Validate & Analyze from the study fieldbook to review collected data before moving into analysis. Resolve obvious missing or invalid observations before treating the dataset as analysis-ready."
        ]
      }
    ]
  }
];

export const reportTutorials: Tutorial[] = [
  {
    slug: "reports-and-saved-analyses",
    title: "Reports and Saved Analyses",
    category: "Reports & Saved Analyses",
    description: "Know what is durable today and when you must download the report immediately.",
    keywords: ["report", "word", "download", "persistent", "saved", "history", "preview"],
    sections: [
      {
        title: "Word reports",
        paragraphs: [
          "Supported ANOVA results provide a Word-report download from the results screen. The report belongs to the analysis that produced it; if VivaSense says the exact analysis identity is no longer available, rerun the analysis instead of trying to reconstruct a report from a different result."
        ]
      },
      {
        title: "Persistent RCBD",
        paragraphs: [
          "RCBD currently uses the durable AnalysisRun pathway. Its saved history record can reopen the completed run and download the report associated with that exact stored analysis."
        ]
      },
      {
        title: "CRD Early Access",
        paragraphs: [
          "CRD is available as an Early Access analysis with Word-report download. The current durable reopen workflow is specifically RCBD, so retain the CRD report you need for your records."
        ]
      },
      {
        title: "Preview designs",
        bullets: [
          "Factorial CRD, Factorial RCBD, and Split-Plot RCBD are session-only Preview workflows.",
          "Download the Word report before leaving the analysis session.",
          "Do not assume a Preview analysis can be reopened later simply because an analysis-history row exists."
        ]
      }
    ]
  }
];

export const allTutorials = [
  ...gettingStartedTutorials,
  ...analysisTutorials,
  ...fieldLayoutTutorials,
  ...dataCaptureTutorials,
  ...reportTutorials
];

export const tutorialCategories: TutorialCategory[] = [
  "Getting Started",
  "Experimental Design & ANOVA",
  "Field Layout",
  "Data Capture",
  "Reports & Saved Analyses"
];
