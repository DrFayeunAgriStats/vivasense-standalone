import { useRef } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { buildHistogram } from "@/lib/assumptions/computeDiagnostics";
import { exportChartPng } from "@/components/vivasense/advanced/shared";

interface Props { residuals: number[]; }

export function ResidualHistogram({ residuals }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const bins = buildHistogram(residuals, Math.min(15, Math.max(6, Math.round(Math.sqrt(residuals.length)))));
  if (!bins.length) return null;
  const data = bins.map((b) => ({ x: b.binMid.toFixed(2), count: b.count, normal: b.normal }));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-serif text-base font-semibold">Residual Distribution</h4>
        <Button variant="ghost" size="sm" onClick={() => exportChartPng(ref.current, "residual_histogram.png")}>
          <Download className="w-3.5 h-3.5 mr-1" /> PNG
        </Button>
      </div>
      <div ref={ref} className="w-full h-64">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: "Residual", position: "insideBottom", offset: -10, fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: "Frequency", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.7} />
            <Line type="monotone" dataKey="normal" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
