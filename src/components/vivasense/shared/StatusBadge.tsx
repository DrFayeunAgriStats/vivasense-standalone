import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "info" | "success" | "warning" | "danger" | "neutral";

const toneClass: Record<StatusTone, string> = {
  info: "bg-primary/10 text-primary border-primary/25",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <Badge className={cn("border font-medium", toneClass[tone], className)}>
      {label}
    </Badge>
  );
}
