import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/vivasense/shared/Card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, hint, icon, className }: MetricCardProps) {
  return (
    <Card className={cn("rounded-xl", className)}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
          </div>
          {icon ? <div className="text-primary/80">{icon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
