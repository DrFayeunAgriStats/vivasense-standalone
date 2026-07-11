import { useRef } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { ResidualPoint } from "@/lib/assumptions/computeDiagnostics";
import { exportChartPng } from "@/components/vivasense/advanced/shared";

interface Props { points: ResidualPoint[]; }

export function ResidualsVsFitted({ points }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!points.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-serif text-base font-semibold">Residuals vs Fitted</h4>
        <Button variant="ghost" size="sm" onClick={() => exportChartPng(ref.current, "residuals_vs_fitted.png")}>
          <Download className="w-3.5 h-3.5 mr-1" /> PNG
        </Button>
      </div>
      <div ref={ref} className="w-full h-64">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="fitted" tick={{ fontSize: 11 }} label={{ value: "Fitted value", position: "insideBottom", offset: -10, fontSize: 12 }} />
            <YAxis type="number" dataKey="residual" tick={{ fontSize: 11 }} label={{ value: "Residual", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
            <Tooltip formatter={((v: any) => typeof v === "number" ? v.toFixed(3) : "") as any} />
            <Scatter data={points} fill="hsl(var(--primary))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
