import { Badge } from "@/components/ui/badge";
export function VivaSensePlanBadge() {
  return <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground hidden sm:inline">All released tools are free</span>
    <Badge variant="secondary" className="bg-muted text-foreground border-border">Free Research Access</Badge>
  </div>;
}
