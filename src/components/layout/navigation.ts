import {
  CircleHelp,
  ClipboardList,
  FlaskConical,
  LayoutGrid,
  Leaf,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
}

export interface ModuleNavItem {
  module: "anova" | "field-layout";
  label: string;
  icon: LucideIcon;
}

export const workspaceNav: AppNavItem[] = [
  { to: "/workspace", label: "Research Workspace", icon: Leaf },
  { to: "/data-capture", label: "Data Capture", icon: ClipboardList },
  { to: "/help", label: "Help & Learning", icon: CircleHelp, matchPrefix: true },
];

export const analysisNav: ModuleNavItem[] = [
  { module: "anova", label: "Experimental Design & ANOVA", icon: FlaskConical },
  { module: "field-layout", label: "Field Layout", icon: LayoutGrid },
];

export const mobileNav: AppNavItem[] = [
  { to: "/workspace", label: "Research Workspace", icon: Leaf },
  { to: "/workspace?module=anova", label: "Experimental Design & ANOVA", icon: FlaskConical },
  { to: "/workspace?module=field-layout", label: "Field Layout", icon: LayoutGrid },
  { to: "/data-capture", label: "Data Capture", icon: ClipboardList },
  { to: "/help", label: "Help & Learning", icon: CircleHelp, matchPrefix: true },
];
