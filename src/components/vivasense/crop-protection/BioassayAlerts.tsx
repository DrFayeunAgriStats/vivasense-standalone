/**
 * Data-quality alerts for a bioassay run.
 *
 * These are backend scientific warnings, not request failures — the two are
 * kept visually and structurally separate so a warning is never mistaken for a
 * failed analysis. Nothing here invalidates an experiment; the wording tells
 * the researcher what to check.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, OctagonAlert, ShieldCheck } from "lucide-react";
import type { BioassayWarning } from "@/types/cropProtection";

type Severity = "info" | "warning" | "error";

const SEVERITY_STYLES: Record<Severity, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200",
  error:
    "border-destructive/40 bg-destructive/5 text-destructive dark:border-destructive/50",
};

/** Researcher-facing headline per backend warning code. */
const CODE_TITLES: Record<string, string> = {
  non_monotonic_cumulative_mortality: "Cumulative mortality decreased",
  repeated_control_blocks: "Repeated control blocks detected",
  high_control_mortality: "High control mortality",
  unequal_cell_replication: "Unequal cell replication",
  residual_non_normality: "Residual normality concern",
  variance_heterogeneity: "Variance homogeneity concern",
  abbott_floor_applied: "Abbott values floored at zero",
  co_toxicity_ceiling_effect: "Co-toxicity ceiling effect",
  co_toxicity_missing_matched_dose: "Missing matched dose for joint action",
};

function severityOf(warning: BioassayWarning): Severity {
  if (warning.severity === "info" || warning.severity === "error") return warning.severity;
  return "warning";
}

function iconFor(severity: Severity) {
  if (severity === "info") return Info;
  if (severity === "error") return OctagonAlert;
  return AlertTriangle;
}

/** Extra context the backend puts in `details`, rendered only when it is useful. */
function detailLine(warning: BioassayWarning): string | null {
  const d = warning.details ?? {};
  if (warning.code === "high_control_mortality") {
    const observed = d.observed as number | undefined;
    const threshold = d.threshold as number | undefined;
    if (observed === undefined) return null;
    return `Observed ${observed.toFixed(1)}%${
      threshold === undefined ? "" : ` against a declared threshold of ${threshold.toFixed(1)}%`
    }. Confirm assay validity against the relevant protocol.`;
  }
  if (warning.code === "repeated_control_blocks") {
    const n = d.n_control as number | undefined;
    const removed = d.duplicates_removed as number | undefined;
    const rule = d.selection_rule as string | undefined;
    if (n === undefined) return null;
    return `A single unique ${n}-replicate control profile was used${
      removed ? ` after removing ${removed} repeated row(s)` : ""
    }${rule ? ` under the "${rule.replace(/_/g, " ")}" policy` : ""}.`;
  }
  if (warning.code === "abbott_floor_applied") {
    const time = d.observation_time as number | undefined;
    return time === undefined
      ? null
      : `Applied at the ${time} observation time. Corrected mortality below zero was set to zero.`;
  }
  if (warning.code === "co_toxicity_ceiling_effect" || warning.code === "co_toxicity_missing_matched_dose") {
    const dose = d.dose as number | undefined;
    const time = d.observation_time as number | undefined;
    if (dose === undefined) return null;
    return `Dose ${dose}${time === undefined ? "" : `, observation time ${time}`}.`;
  }
  if (warning.code === "residual_non_normality" || warning.code === "variance_heterogeneity") {
    const test = d.test as string | undefined;
    const p = d.p_value as number | undefined;
    if (!test || p === undefined) return null;
    return `${test} p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}.`;
  }
  return null;
}

interface Props {
  warnings: BioassayWarning[];
  /** Cumulative-mortality decreases carry per-unit detail worth listing. */
  cumulativeDecreases?: {
    treatment: string;
    dose: number;
    replicate: string;
    from_time: number;
    to_time: number;
    from_raw_mortality: number;
    to_raw_mortality: number;
  }[];
}

export function BioassayAlerts({ warnings, cumulativeDecreases = [] }: Props) {
  if (warnings.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          No data-quality warnings were raised for this run.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Data Quality Alerts</CardTitle>
        <p className="text-sm text-muted-foreground">
          Biological and structural checks reported by the analysis engine. These are
          advisory — they do not invalidate the experiment.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {warnings.map((warning, index) => {
          const severity = severityOf(warning);
          const Icon = iconFor(severity);
          const detail = detailLine(warning);
          return (
            <div
              key={`${warning.code}-${warning.response_id ?? "all"}-${index}`}
              className={`rounded-md border p-3 text-sm ${SEVERITY_STYLES[severity]}`}
            >
              <p className="flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4 shrink-0" />
                {CODE_TITLES[warning.code] ?? warning.code.replace(/_/g, " ")}
                {warning.response_id && (
                  <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs font-normal dark:bg-white/10">
                    {warning.response_id}
                  </span>
                )}
              </p>
              <p className="mt-1 opacity-90">{warning.message}</p>
              {detail && <p className="mt-1 text-xs opacity-80">{detail}</p>}

              {warning.code === "non_monotonic_cumulative_mortality" &&
                cumulativeDecreases.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs opacity-90">
                    {cumulativeDecreases.map((d, i) => (
                      <li key={i}>
                        Mortality decreased from {d.from_raw_mortality}% at {d.from_time} to{" "}
                        {d.to_raw_mortality}% at {d.to_time} for {d.treatment}, Dose {d.dose},
                        Replicate {d.replicate}. Check the original observations.
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
