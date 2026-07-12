import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/vivasense/shared/Card";

interface ChartCardProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, actions, children }: ChartCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
