import { useRef } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { buildQQPoints } from "@/lib/assumptions/computeDiagnostics";
import { exportChartPng } from "@/components/vivasense/advanced/shared";

interface Props { residuals: number[]; }

export function QQPlot({ residuals }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pts = buildQQPoints(residuals);
  if (!pts.length) return null;
  // Reference line: 45° through robust slope; use sample sd as scale.
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const sd = Math.sqrt(residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, residuals.length - 1));
  const minT = Math.min(...pts.map((p) => p.theoretical));
  const maxT = Math.max(...pts.map((p) => p.theoretical));
  const refLine = [
    { theoretical: minT, ref: mean + sd * minT },
    { theoretical: maxT, ref: mean + sd * maxT },
  ];
  const merged = pts.map((p) => ({ ...p, ref: mean + sd * p.theoretical }));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-serif text-base font-semibold">Normal Q-Q Plot</h4>
        <Button variant="ghost" size="sm" onClick={() => exportChartPng(ref.current, "qq_plot.png")}>
          <Download className="w-3.5 h-3.5 mr-1" /> PNG
        </Button>
      </div>
      <div ref={ref} className="w-full h-64">
        <ResponsiveContainer>
          <ComposedChart data={merged} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="theoretical" tick={{ fontSize: 11 }} label={{ value: "Theoretical quantile", position: "insideBottom", offset: -10, fontSize: 12 }} />
            <YAxis type="number" dataKey="sample" tick={{ fontSize: 11 }} label={{ value: "Sample residual", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip formatter={((v: any) => typeof v === "number" ? v.toFixed(3) : "") as any} />
            <Line type="linear" dataKey="ref" data={refLine} stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} />
            <Scatter dataKey="sample" fill="hsl(var(--primary))" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
