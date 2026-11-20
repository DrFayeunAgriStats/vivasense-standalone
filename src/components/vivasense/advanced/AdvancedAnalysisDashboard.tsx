import { SampleDatasets } from "@/components/help/SampleDatasets";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Sigma, Compass, Network, GitBranch, Award, Link2 } from "lucide-react";
import type { DatasetContext } from "@/types/geneticsUpload";
import { StabilityPanel } from "./StabilityPanel";
import { BlupPanel } from "./BlupPanel";
import { PcaPanel } from "./PcaPanel";
import { ClusterPanel } from "./ClusterPanel";
import { PathAnalysisPanel } from "./PathAnalysisPanel";
import { SelectionIndexPanel } from "./SelectionIndexPanel";
import { TraitAssociationPanel } from "./TraitAssociationPanel";

export type AdvancedModuleId =
  | "stability" | "blup" | "pca" | "cluster"
  | "path-analysis" | "selection-index" | "trait-association";

interface Props {
  datasetContext: DatasetContext | null;
  initialModule?: AdvancedModuleId | null;
  /** When true, renders without the back-to-modules navigation (used inside parent tabs). */
  embedded?: boolean;
}

const MODULES: {
  id: AdvancedModuleId;
  title: string;
  description: string;
  icon: React.ElementType;
  badge: string;
}[] = [
  {
    id: "stability",
    title: "Stability Analysis",
    description: "Explore genotype response patterns across environments; stability classifications remain provisional.",
    icon: TrendingUp,
    badge: "G×E",
  },
  {
    id: "blup",
    title: "BLUP Predictions",
    description: "Explore model-based BLUP estimates with their assumptions and uncertainty; not independently validated.",
    icon: Sigma,
    badge: "Mixed model",
  },
  {
    id: "pca",
    title: "Principal Component Analysis",
    description: "Explore multivariate structure through scree and biplots; interpret components cautiously.",
    icon: Compass,
    badge: "Multivariate",
  },
  {
    id: "cluster",
    title: "Cluster Analysis",
    description: "Explore trait-similarity clusters; grouping does not prove biological distinctness.",
    icon: Network,
    badge: "Grouping",
  },
  {
    id: "path-analysis",
    title: "Path Analysis",
    description: "Explore specified path coefficients; association alone does not establish causal effects.",
    icon: GitBranch,
    badge: "Association",
  },
  {
    id: "selection-index",
    title: "Selection Index",
    description: "Explore weighted trait scores; breeding recommendations require independent validation.",
    icon: Award,
    badge: "Breeding",
  },
  {
    id: "trait-association",
    title: "Trait Association",
    description: "Explore trait associations with data-quality checks; statistical association is not causation.",
    icon: Link2,
    badge: "Association",
  },
];

export function AdvancedAnalysisDashboard({ datasetContext, initialModule = null, embedded = false }: Props) {
  const [active, setActive] = useState<AdvancedModuleId | null>(initialModule);

  if (active) {
    const Panel = active === "stability" ? StabilityPanel
      : active === "blup" ? BlupPanel
      : active === "pca" ? PcaPanel
      : active === "cluster" ? ClusterPanel
      : active === "path-analysis" ? PathAnalysisPanel
      : active === "trait-association" ? TraitAssociationPanel
      : SelectionIndexPanel;
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setActive(null)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to advanced modules
        </Button>
        <SampleDatasets ids={active === "stability" ? ["met"] : ["rcbd", "met"]} />
        <Panel datasetContext={datasetContext} />
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "space-y-6"}>
      {!embedded && (
        <div className="max-w-3xl">
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Advanced Analysis</h2>
          <p className="text-muted-foreground">
            Experimental multivariate and mixed-model analyses for exploratory research. Scientific validation remains in progress.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 group"
              onClick={() => setActive(m.id)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/5 p-2.5 group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase">{m.badge}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base mb-1">{m.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); setActive(m.id); }}>
                  Run Analysis
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
