/**
 * Treatment × Dose interaction plot.
 *
 * Plots the backend's display-scale means — the biological scale the researcher
 * measured — never the transformed values the ANOVA ran on.
 */
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmt } from "./format";
import type { InteractionMean } from "@/types/cropProtection";

const SERIES_COLORS = ["#0f766e", "#b45309", "#4338ca", "#be123c", "#0369a1", "#4d7c0f"];

interface Props {
  means: InteractionMean[];
  responseLabel: string;
  displayColumn?: string;
}

export function InteractionPlot({ means, responseLabel, displayColumn }: Props) {
  const treatments = Array.from(new Set(means.map((m) => m.treatment)));
  const doses = Array.from(new Set(means.map((m) => m.dose))).sort((a, b) => a - b);

  const data = doses.map((dose) => {
    const point: Record<string, number | string> = { dose };
    for (const treatment of treatments) {
      const cell = means.find((m) => m.treatment === treatment && m.dose === dose);
      if (cell) point[treatment] = cell.mean;
    }
    return point;
  });

  return (
    <div className="space-y-2">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="dose"
              tick={{ fontSize: 12 }}
              label={{ value: "Dose", position: "insideBottom", offset: -12, fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: responseLabel,
                angle: -90,
                position: "insideLeft",
                fontSize: 12,
              }}
            />
            <Tooltip formatter={(value) => fmt(value)} />
            <Legend />
            {treatments.map((treatment, index) => (
              <Line
                key={treatment}
                type="monotone"
                dataKey={treatment}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                dot
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Means are plotted on the biological/raw scale
        {displayColumn ? ` (${displayColumn})` : ""}. Non-parallel lines indicate that the
        dose response differs between treatments.
      </p>
    </div>
  );
}
