import { Badge } from "@/components/ui/badge";

export function VivaSensePlanBadge() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        All implemented modules available for testing
      </span>
      <Badge
        variant="default"
        className="text-white border-transparent hover:opacity-90"
        style={{ backgroundColor: "#1B5E20" }}
      >
        Early Access
      </Badge>
    </div>
  );
}
