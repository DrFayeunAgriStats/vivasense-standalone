/**
 * Residual diagnostics per response.
 *
 * When the backend reports a failed test the verdict says so — "Questionable"
 * or "Heterogeneous", never "Assumptions satisfied".
 */
import { Badge } from "@/components/ui/badge";
import { formatP } from "./format";
import type { AssumptionTest, BioassayDiagnostics } from "@/types/cropProtection";

function verdict(test: AssumptionTest | null, passedLabel: string, failedLabel: string) {
  if (!test) return { label: "Not assessed", tone: "outline" as const, detail: null };
  return {
    label: test.passed ? passedLabel : failedLabel,
    tone: test.passed ? ("secondary" as const) : ("destructive" as const),
    detail: `${test.test} p = ${formatP(test.p_value)}`,
  };
}

interface Props {
  diagnostics: BioassayDiagnostics;
  warnings: string[];
}

export function DiagnosticsResults({ diagnostics, warnings }: Props) {
  const normality = verdict(diagnostics.residual_normality, "Satisfied", "Questionable");
  const homogeneity = verdict(diagnostics.homogeneity, "Satisfied", "Heterogeneous");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Residual normality</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={normality.tone}>{normality.label}</Badge>
            {normality.detail && (
              <span className="text-xs text-muted-foreground">{normality.detail}</span>
            )}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Variance homogeneity</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={homogeneity.tone}>{homogeneity.label}</Badge>
            {homogeneity.detail && (
              <span className="text-xs text-muted-foreground">{homogeneity.detail}</span>
            )}
          </div>
          {diagnostics.homogeneity?.grouping && (
            <p className="mt-1 text-xs text-muted-foreground">
              Grouping: {diagnostics.homogeneity.grouping}
            </p>
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div>
          <p className="text-sm font-medium">Warnings</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
