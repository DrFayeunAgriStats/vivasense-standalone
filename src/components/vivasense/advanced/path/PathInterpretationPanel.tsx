import { Card, CardContent } from "@/components/ui/card";
import { InterpretationPanel as BaseInterpretationPanel } from "../shared";

interface Props {
  interpretation?: string;
  rSquared?: number;
  residualEffect?: number;
  nObservations?: number;
}

const fmt = (v: number | null | undefined, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";

export function PathInterpretationPanel({
  interpretation,
  rSquared,
  residualEffect,
  nObservations,
}: Props) {
  if (!interpretation && rSquared == null && residualEffect == null && nObservations == null) {
    return null;
  }
  const pct =
    typeof rSquared === "number" && Number.isFinite(rSquared)
      ? (rSquared * 100).toFixed(1)
      : null;
  return (
    <div className="space-y-3">
      {interpretation && <BaseInterpretationPanel text={interpretation} />}
      <Card className="bg-primary/[0.03] border-primary/20">
        <CardContent className="p-5">
          <h5 className="font-serif text-sm font-semibold text-foreground mb-3">
            Model fit summary
          </h5>
          <ul className="space-y-1.5 text-sm text-foreground/90">
            <li>
              <span className="font-medium">R² = </span>
              <span className="tabular-nums">{fmt(rSquared, 4)}</span>
              {pct && (
                <span className="text-muted-foreground"> ({pct}% variation explained)</span>
              )}
            </li>
            <li>
              <span className="font-medium">Residual path coefficient = </span>
              <span className="tabular-nums">{fmt(residualEffect, 4)}</span>
            </li>
            <li>
              <span className="font-medium">n = </span>
              <span className="tabular-nums">
                {typeof nObservations === "number" ? nObservations : "—"}
              </span>{" "}
              observations
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
