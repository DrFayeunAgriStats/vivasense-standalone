import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { AssumptionTestsModal } from "./AssumptionTestsModal";
import type { RawObservation } from "@/lib/assumptions/computeDiagnostics";

interface Props {
  assumptions?: unknown;
  descriptiveStats?: unknown;
  rawRows?: RawObservation[];
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function AssumptionTestsButton({
  assumptions,
  descriptiveStats,
  rawRows,
  variant = "outline",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const hasAnything = !!assumptions || (Array.isArray(descriptiveStats) && descriptiveStats.length > 0) || (rawRows && rawRows.length > 0);
  // Temporary diagnostic — confirms whether the gate sees the backend fields.
  // Remove once UX is verified across all ANOVA result paths.
  // eslint-disable-next-line no-console
  console.debug("[AssumptionTestsButton] gate", {
    hasAssumptions: !!assumptions,
    assumptionsType: assumptions ? typeof assumptions : null,
    descriptiveStatsLen: Array.isArray(descriptiveStats) ? descriptiveStats.length : null,
    rawRowsLen: rawRows?.length ?? null,
    willRender: hasAnything,
  });
  if (!hasAnything) return null;
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <BarChart3 className="w-4 h-4 mr-2" />
        📊 Assumption Tests
      </Button>
      <AssumptionTestsModal
        open={open}
        onOpenChange={setOpen}
        assumptions={assumptions}
        descriptiveStats={descriptiveStats}
        rawRows={rawRows}
      />
    </>
  );
}
