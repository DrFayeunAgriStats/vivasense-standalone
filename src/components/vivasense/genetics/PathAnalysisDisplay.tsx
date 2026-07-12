import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  data: Record<string, unknown>;
  traitName: string;
}

/**
 * PathAnalysisDisplay — Display path analysis inputs/setup for a single trait.
 * Part of the GeneticsTraitResult workflow.
 */
export function PathAnalysisDisplay({ data, traitName }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          Path Analysis Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Path analysis decomposes trait correlations into direct and indirect effects.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Outcome trait:</strong> {traitName}
        </p>
        <p className="text-sm text-muted-foreground italic">
          Run path analysis from the Advanced Analytics module for detailed causal decomposition.
        </p>
      </CardContent>
    </Card>
  );
}
