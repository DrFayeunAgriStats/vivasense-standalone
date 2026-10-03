import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FlaskConical, LayoutGrid, Leaf, ClipboardList, CircleHelp } from "lucide-react";
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
  { module: "anova", label: "Experimental Design", icon: FlaskConical },
  { module: "field-layout", label: "Field Layout", icon: LayoutGrid },
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
              Analysis Modules
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
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1 flex flex-col">
          {/* Narrow screens: the sidebar is hidden below md, which used to leave
              Data Capture and Field Layout unreachable. Same destinations, shown
              as a horizontally scrollable bar — the desktop navigation is unchanged. */}
          {!hideSidebar && (
            <nav
              aria-label="Workspace navigation"
              className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:hidden"
            >
              {nav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
              {modules.map((item) => {
                const Icon = item.icon;
                const active = pathname === "/workspace" && activeModule === item.module;
                return (
                  <Link
                    key={item.module}
                    to={`/workspace?module=${item.module}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {children}
          {!hideSidebar && showFooter && <Footer variant={footerVariant} />}
        </main>
      </div>

      {hideSidebar && showFooter && <Footer variant={footerVariant} />}
    </div>
  );
}
