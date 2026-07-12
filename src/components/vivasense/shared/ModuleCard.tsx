import type { ReactNode } from "react";

import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/vivasense/shared/Card";
import { StatusBadge } from "@/components/vivasense/shared/StatusBadge";

interface ModuleCardProps {
  title: string;
  icon: ReactNode;
  items: string[];
  onClick?: () => void;
  badgeLabel?: string;
}

export function ModuleCard({ title, icon, items, onClick, badgeLabel }: ModuleCardProps) {
  return (
    <Card
      className="group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badgeLabel ? <StatusBadge label={badgeLabel} tone="info" className="mb-3" /> : null}
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
