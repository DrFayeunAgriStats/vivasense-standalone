/**
 * Joint action / co-toxicity under Bliss independence.
 *
 * The backend deliberately separates the descriptive direction of a deviation
 * from what the bootstrap interval can actually support. A positive excess whose
 * CI spans zero is "not distinguishable from additivity" — it is never collapsed
 * to "synergistic" here, because that would assert a conclusion the interval
 * does not license.
 */
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cotoxicityInterpretation, fmt, fmtDose } from "./format";
import type { CotoxicityByTime, CotoxicityResult } from "@/types/cropProtection";

function interpretationTone(inference: string | null): string {
  if (inference === "supports_synergy_under_bliss") {
    return "text-emerald-700 dark:text-emerald-400";
  }
  if (inference === "supports_antagonism_under_bliss") {
    return "text-red-700 dark:text-red-400";
  }
  if (inference === "ceiling_limited") return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}

function TimeBlock({ block, result }: { block: CotoxicityByTime; result: CotoxicityResult }) {
  const chartData = block.cells
    .filter((cell) => cell.available)
    .map((cell) => ({
      dose: cell.dose,
      expected: cell.bliss_expected,
      observed: cell.mixture.mean_corrected_mortality,
    }))
    .sort((a, b) => a.dose - b.dose);

  const ceilingLimited = block.cells.filter((cell) => cell.ceiling_effect);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">
          Observation time {block.observation_time} {block.time_unit}
        </h4>
        <Badge variant="outline">{block.summary.number_of_matched_doses} matched doses</Badge>
        {block.summary.number_supporting_synergy > 0 && (
          <Badge variant="secondary">{block.summary.number_supporting_synergy} supporting synergy</Badge>
        )}
        {block.summary.number_supporting_antagonism > 0 && (
          <Badge variant="secondary">
            {block.summary.number_supporting_antagonism} supporting antagonism
          </Badge>
        )}
        {block.summary.number_inconclusive > 0 && (
          <Badge variant="secondary">{block.summary.number_inconclusive} inconclusive</Badge>
        )}
        {block.summary.number_ceiling_limited > 0 && (
          <Badge variant="secondary">{block.summary.number_ceiling_limited} ceiling limited</Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Dose</TableHead>
              <TableHead className="text-right">{result.component_a}</TableHead>
              <TableHead className="text-right">{result.component_b}</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Observed mixture</TableHead>
              <TableHead className="text-right">Excess</TableHead>
              <TableHead className="text-right">Ratio</TableHead>
              <TableHead className="text-right whitespace-nowrap">95% CI</TableHead>
              <TableHead>Interpretation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.cells.map((cell) => (
              <TableRow key={cell.dose}>
                <TableCell className="text-right tabular-nums font-medium">
                  {fmtDose(cell.dose)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(cell.component_a.mean_corrected_mortality, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(cell.component_b.mean_corrected_mortality, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(cell.bliss_expected, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(cell.mixture.mean_corrected_mortality, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {cell.excess_observed_minus_expected === null
                    ? "—"
                    : `${cell.excess_observed_minus_expected > 0 ? "+" : ""}${fmt(
                        cell.excess_observed_minus_expected, 2
                      )}`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(cell.observed_expected_ratio, 3)}
                </TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">
                  {cell.bootstrap_ci
                    ? `${fmt(cell.bootstrap_ci.low, 1)} to ${fmt(cell.bootstrap_ci.high, 1)}`
                    : "—"}
                </TableCell>
                <TableCell className={`text-xs ${interpretationTone(cell.inference)}`}>
                  {cell.available
                    ? cotoxicityInterpretation(cell.inference, cell.descriptive_direction)
                    : "No matched dose available"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {ceilingLimited.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Expected mortality is near 100% at dose
            {ceilingLimited.length > 1 ? "s " : " "}
            {ceilingLimited.map((cell) => fmtDose(cell.dose)).join(", ")}; joint-action
            classification is limited by a ceiling effect.
          </span>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dose"
                tick={{ fontSize: 12 }}
                label={{ value: "Dose", position: "insideBottom", offset: -12, fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{
                  value: "Corrected mortality (%)",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 12,
                }}
              />
              <Tooltip formatter={(value) => `${fmt(value, 1)}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="expected"
                name="Expected (Bliss)"
                stroke="#94a3b8"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot
              />
              <Line
                type="monotone"
                dataKey="observed"
                name={`Observed ${result.mixture}`}
                stroke="#0f766e"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function CotoxicityResults({ result }: { result: CotoxicityResult }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">Method: Bliss independence</Badge>
        <Badge variant="outline">A: {result.component_a}</Badge>
        <Badge variant="outline">B: {result.component_b}</Badge>
        <Badge variant="outline">Mixture: {result.mixture}</Badge>
      </div>
      {result.by_time.map((block) => (
        <TimeBlock key={`${block.observation_time}-${block.time_unit}`} block={block} result={result} />
      ))}
      <p className="text-xs text-muted-foreground">
        Expected mortality follows Bliss independence (A + B − AB/100) on Abbott-corrected
        percentages. Confidence intervals come from nonparametric bootstrap resampling within
        each treatment role; a deviation whose interval includes zero is reported as not
        distinguishable from additivity.
      </p>
    </div>
  );
}
