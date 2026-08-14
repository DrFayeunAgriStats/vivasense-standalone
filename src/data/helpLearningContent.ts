export type TutorialCategory =
  | "Getting Started"
  | "Experimental Design & ANOVA"
  | "Genetics & Breeding"
  | "Advanced Analytics";

export interface Tutorial {
  slug: string;
  title: string;
  category: TutorialCategory;
  description: string;
  keywords: string[];
  status?: "under-review";
}

export interface VideoTutorial {
  title: string;
  category: TutorialCategory;
  duration: string;
  description: string;
  url?: string;
}

export const gettingStartedTutorials: Tutorial[] = [
  { slug: "introduction", title: "Introduction to VivaSense", category: "Getting Started", description: "An orientation to the VivaSense research workspace.", keywords: ["welcome", "workspace", "overview"] },
  { slug: "preparing-your-dataset", title: "Preparing Your Dataset", category: "Getting Started", description: "A future guide to organising data before it enters VivaSense.", keywords: ["dataset", "data", "prepare"], status: "under-review" },
  { slug: "uploading-data", title: "Uploading Data", category: "Getting Started", description: "Learn where data upload begins in the current workspace.", keywords: ["upload", "file", "csv", "excel"] },
  { slug: "mapping-columns", title: "Mapping Columns", category: "Getting Started", description: "A future guide to confirming the roles of dataset columns.", keywords: ["mapping", "columns", "genotype", "replication"], status: "under-review" },
  { slug: "experimental-structure", title: "Understanding Experimental Structure", category: "Getting Started", description: "A future guide to the experimental information requested by VivaSense.", keywords: ["environment", "location", "year", "replication", "structure"], status: "under-review" },
  { slug: "first-analysis", title: "Running Your First Analysis", category: "Getting Started", description: "An orientation to selecting a current VivaSense analysis module.", keywords: ["first", "analysis", "anova"] },
  { slug: "understanding-results", title: "Understanding Your Results", category: "Getting Started", description: "A future guide to reading VivaSense result screens.", keywords: ["results", "output", "interpretation"], status: "under-review" },
  { slug: "exporting-report", title: "Exporting Your Report", category: "Getting Started", description: "Find the report download actions available after supported analyses.", keywords: ["export", "report", "download"] },
];

export const analysisTutorials: Tutorial[] = [
  { slug: "crd", title: "CRD", category: "Experimental Design & ANOVA", description: "Tutorial content for the current CRD option.", keywords: ["crd", "anova", "experimental design"], status: "under-review" },
  { slug: "rcbd", title: "RCBD", category: "Experimental Design & ANOVA", description: "Tutorial content for the current RCBD option.", keywords: ["rcbd", "anova", "block", "replication"], status: "under-review" },
  { slug: "factorial-experiments", title: "Factorial experiments", category: "Experimental Design & ANOVA", description: "Tutorial content for the current factorial option.", keywords: ["factorial", "factor a", "factor b", "factor c"], status: "under-review" },
  { slug: "split-plot", title: "Split-plot RCBD", category: "Experimental Design & ANOVA", description: "Tutorial content for the current split-plot option.", keywords: ["split plot", "main plot", "subplot"], status: "under-review" },
  { slug: "multi-environment-trials", title: "Multi-environment trials", category: "Experimental Design & ANOVA", description: "Tutorial content for the current multi-environment workflow.", keywords: ["multi environment", "location", "year", "environment"], status: "under-review" },
  { slug: "genetic-parameters", title: "Genetic parameters", category: "Genetics & Breeding", description: "Tutorial content for the current genetic-parameters workflow.", keywords: ["genetic parameters", "variance", "heritability", "genetic advance"], status: "under-review" },
  { slug: "trait-relationships", title: "Correlation / trait relationships", category: "Genetics & Breeding", description: "Tutorial content for the current trait-relationship workflow.", keywords: ["correlation", "trait", "relationship"], status: "under-review" },
  { slug: "regression", title: "Regression", category: "Advanced Analytics", description: "Tutorial content for the current regression workflow.", keywords: ["regression", "predictor", "response"], status: "under-review" },
  { slug: "pca", title: "Principal Component Analysis", category: "Advanced Analytics", description: "Tutorial content for the current PCA module.", keywords: ["pca", "principal component", "multivariate"], status: "under-review" },
  { slug: "cluster-analysis", title: "Cluster analysis", category: "Advanced Analytics", description: "Tutorial content for the current cluster-analysis module.", keywords: ["cluster", "grouping"], status: "under-review" },
  { slug: "path-analysis", title: "Path analysis", category: "Advanced Analytics", description: "Tutorial content for the current path-analysis module.", keywords: ["path", "direct", "indirect"], status: "under-review" },
  { slug: "stability-analysis", title: "Stability analysis", category: "Advanced Analytics", description: "Tutorial content for the current stability-analysis module.", keywords: ["stability", "ammi", "gge"], status: "under-review" },
  { slug: "blup-predictions", title: "BLUP predictions", category: "Advanced Analytics", description: "Tutorial content for the current BLUP module.", keywords: ["blup", "mixed model", "prediction"], status: "under-review" },
  { slug: "selection-index", title: "Selection index", category: "Advanced Analytics", description: "Tutorial content for the current selection-index module.", keywords: ["selection index", "ranking"], status: "under-review" },
];

export const allTutorials = [...gettingStartedTutorials, ...analysisTutorials];

export const tutorialCategories: TutorialCategory[] = [
  "Getting Started",
  "Experimental Design & ANOVA",
  "Genetics & Breeding",
  "Advanced Analytics",
];

export const videoTutorials: VideoTutorial[] = [
  { title: "Getting started with VivaSense", category: "Getting Started", duration: "Coming soon", description: "A short orientation video will be added after review." },
  { title: "Preparing an ANOVA dataset", category: "Experimental Design & ANOVA", duration: "Coming soon", description: "A guided product walkthrough will be added after scientific review." },
  { title: "Finding the right advanced analysis", category: "Advanced Analytics", duration: "Coming soon", description: "A module-selection overview will be added when the video is available." },
];
