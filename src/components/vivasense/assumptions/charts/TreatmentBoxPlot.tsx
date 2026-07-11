import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { BoxPlotDatum } from "@/lib/assumptions/computeDiagnostics";
import { exportChartPng } from "@/components/vivasense/advanced/shared";

interface Props {
  data: BoxPlotDatum[];
  approximate?: boolean;
}

/** Pure-SVG box plot — Recharts has no native boxplot. */
export function TreatmentBoxPlot({ data, approximate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!data.length) return null;

  const width = 720;
  const height = 360;
  const margin = { top: 20, right: 24, bottom: 56, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const allValues = data.flatMap((d) => [d.min, d.max, ...d.outliers]);
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yPad = (yMax - yMin) * 0.05 || 1;
  const yScale = (v: number) => margin.top + innerH - ((v - (yMin - yPad)) / (yMax - yMin + 2 * yPad)) * innerH;

  const boxW = Math.min(60, (innerW / data.length) * 0.5);
  const groupX = (i: number) => margin.left + (innerW / data.length) * (i + 0.5);

  const yTicks: number[] = [];
  const step = (yMax - yMin + 2 * yPad) / 6;
  for (let i = 0; i <= 6; i++) yTicks.push(yMin - yPad + step * i);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-serif text-base font-semibold">Treatment Box Plot</h4>
          {approximate && (
            <p className="text-xs text-muted-foreground">Quartiles approximated from mean ± SD (raw observations unavailable).</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => exportChartPng(ref.current, "treatment_boxplot.png")}>
          <Download className="w-3.5 h-3.5 mr-1" /> PNG
        </Button>
      </div>
      <div ref={ref} className="w-full overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
          {/* Y-axis */}
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="hsl(var(--border))" />
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={margin.left - 4} y1={yScale(v)} x2={margin.left + innerW} y2={yScale(v)} stroke="hsl(var(--border))" strokeDasharray="2 3" opacity={0.4} />
              <text x={margin.left - 8} y={yScale(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={14} y={margin.top + innerH / 2} fontSize={11} fill="hsl(var(--muted-foreground))" transform={`rotate(-90 14 ${margin.top + innerH / 2})`} textAnchor="middle">
            Value
          </text>

          {/* X-axis */}
          <line x1={margin.left} y1={margin.top + innerH} x2={margin.left + innerW} y2={margin.top + innerH} stroke="hsl(var(--border))" />

          {/* Boxes */}
          {data.map((d, i) => {
            const cx = groupX(i);
            return (
              <g key={d.group}>
                {/* Whiskers */}
                <line x1={cx} y1={yScale(d.max)} x2={cx} y2={yScale(d.q3)} stroke="hsl(var(--foreground))" />
                <line x1={cx} y1={yScale(d.q1)} x2={cx} y2={yScale(d.min)} stroke="hsl(var(--foreground))" />
                <line x1={cx - boxW / 3} y1={yScale(d.max)} x2={cx + boxW / 3} y2={yScale(d.max)} stroke="hsl(var(--foreground))" />
                <line x1={cx - boxW / 3} y1={yScale(d.min)} x2={cx + boxW / 3} y2={yScale(d.min)} stroke="hsl(var(--foreground))" />
                {/* Box */}
                <rect
                  x={cx - boxW / 2}
                  y={yScale(d.q3)}
                  width={boxW}
                  height={Math.max(1, yScale(d.q1) - yScale(d.q3))}
                  fill="hsl(var(--primary) / 0.18)"
                  stroke="hsl(var(--primary))"
                />
                {/* Median */}
                <line x1={cx - boxW / 2} y1={yScale(d.median)} x2={cx + boxW / 2} y2={yScale(d.median)} stroke="hsl(var(--primary))" strokeWidth={2} />
                {/* Outliers */}
                {d.outliers.map((o, j) => (
                  <circle key={j} cx={cx} cy={yScale(o)} r={3} fill="hsl(var(--destructive))" />
                ))}
                {/* X label */}
                <text x={cx} y={margin.top + innerH + 16} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
                  {d.group.length > 12 ? d.group.slice(0, 11) + "…" : d.group}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
