/**
 * Crop Protection Analytics landing page.
 *
 * Bioassay / Efficacy Analysis is the only active workflow. Nothing else is
 * advertised, because nothing else is implemented behind it.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Bug, ChevronRight } from "lucide-react";
import { BioassayPanel } from "./BioassayPanel";

type Workflow = "landing" | "bioassay";

const CAPABILITIES = [
  "factorial CRD",
  "mortality and Abbott correction",
  "Tukey mean separation",
  "joint-action / co-toxicity",
  "dose-response",
  "correlation",
  "biological data checks",
];

interface Props {
  /** Deep-link straight into the bioassay workflow. */
  initialWorkflow?: Workflow;
}

export function CropProtectionDashboard({ initialWorkflow = "landing" }: Props) {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow);

  if (workflow === "bioassay") {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setWorkflow("landing")}
        >
          <ArrowLeft className="h-4 w-4" />
          Crop Protection Analytics
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Bioassay / Efficacy Analysis
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Treatment × Dose factorial CRD with control-referenced mortality correction.
          </p>
        </div>
        <BioassayPanel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
        Analyse crop-protection experiments with design-aware statistics and biological
        validation.
      </p>

      <Card className="transition-colors hover:border-primary/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bug className="h-5 w-5 text-primary" />
            Bioassay / Efficacy Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Treatment × Dose factorial CRD, Abbott-corrected mortality, Tukey mean
            separation, and optional joint-action assessment.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <li key={capability} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {capability}
              </li>
            ))}
          </ul>
          <Button className="gap-2" onClick={() => setWorkflow("bioassay")}>
            Open Bioassay / Efficacy Analysis
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
