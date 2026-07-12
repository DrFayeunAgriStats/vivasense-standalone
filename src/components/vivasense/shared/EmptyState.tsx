import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/vivasense/shared/Card";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({ title, description, icon, actions }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        {icon ? <div className="flex justify-center mb-3 text-primary/70">{icon}</div> : null}
        <p className="font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
        {actions ? <div className="mt-4">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
