import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FlaskConical, LayoutGrid, Leaf, ClipboardList, CircleHelp, Sigma } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
  footerVariant?: "default" | "minimal-vivasense";
  hideSidebar?: boolean;
  showFooter?: boolean;
}

const nav = [
  { to: "/workspace", label: "Research Workspace", icon: Leaf },
  { to: "/data-capture", label: "Data Capture", icon: ClipboardList },
  { to: "/help", label: "Help & Learning", icon: CircleHelp },
] as const;

// Early Access navigation exposes only workflows that have completed the
// current verification gate. Hidden modules remain in code and can return to
// navigation after their own validation; this is presentation hardening only.
const modules = [
  { module: "anova", label: "ANOVA & Mean Separation", icon: FlaskConical },
  { module: "field-layout", label: "Field Layout", icon: LayoutGrid },
] as const;

// Verified stand-alone analysis pages (own route, not a /workspace module).
// REL-UI-01: General Correlation is ordinary association among observed
// variables; the subtitle keeps it visibly distinct from genetic correlation.
const routeModules = [
  {
    to: "/relationship-analysis/general",
    label: "General Correlation",
    subtitle: "Observed variables · not genetic",
    description: "Ordinary Pearson/Spearman correlation among observed variables. It does not estimate genetic correlation.",
    icon: Sigma,
  },
] as const;

export function Layout({ children, footerVariant = "minimal-vivasense", hideSidebar = false, showFooter = false }: LayoutProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const activeModule = new URLSearchParams(location.search).get("module");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <div className="flex flex-1">
        {/* Sidebar - hidden on mobile, shown on md+ */}
        {!hideSidebar && (
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-border bg-sidebar px-3 py-6 md:block overflow-y-auto">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Workspace
            </p>
            <nav className="flex flex-col gap-0.5">
              {nav.map((item) => {
                const active = pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <p className="mt-7 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Research Tools
            </p>
            <nav className="flex flex-col gap-0.5">
              {modules.map((item) => {
                const active =
                  pathname === "/workspace" &&
                  activeModule === item.module;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.module}
                    to={`/workspace?module=${item.module}`}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              {routeModules.map((item) => {
                const active = pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.description}
                    aria-label={`${item.label} — ${item.subtitle}`}
                    data-testid="nav-general-correlation"
                    className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4" />
                    <span className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-[11px] leading-tight opacity-80">{item.subtitle}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1 flex flex-col">
          {children}
          {!hideSidebar && showFooter && <Footer variant={footerVariant} />}
        </main>
      </div>

      {hideSidebar && showFooter && <Footer variant={footerVariant} />}
    </div>
  );
}
