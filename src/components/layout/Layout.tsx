import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FlaskConical, Dna, Sparkles, Leaf, ClipboardList, CircleHelp, Bug } from "lucide-react";
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

// `to` overrides the default /workspace?module=<module> target.
//
// Genetics & Breeding is retired from the sidebar: its four-option module
// routes entirely through the legacy Python path, so the R engine's genetics
// computation was never reachable from it. Rather than drop the entry and lose
// the signal that researchers were looking for it, the link now lands on
// Experimental Design carrying intent=genetics, so the destination can pick up
// the genetics workflow once Variance Components & Heritability is wired
// through the validated analyze-upload route.
//
// The /workspace?module=genetics page entry point itself is untouched here —
// only the navigation into it is retired.
const modules = [
  { module: "anova", label: "Experimental Design", icon: FlaskConical },
  {
    module: "anova",
    key: "genetics",
    to: "/workspace?module=anova&intent=genetics",
    label: "Genetics & Breeding",
    icon: Dna,
  },
  { module: "crop-protection", label: "Crop Protection", icon: Bug },
  { module: "advanced", label: "Advanced Analytics", icon: Sparkles },
] as const;

export function Layout({ children, footerVariant = "minimal-vivasense", hideSidebar = false, showFooter = false }: LayoutProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const activeModule = new URLSearchParams(location.search).get("module");
  const activeIntent = new URLSearchParams(location.search).get("intent");

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
                const itemKey = "key" in item ? item.key : item.module;
                // Retired entries share a module with their destination, so
                // highlight on the intent param rather than the module alone.
                const active =
                  pathname === "/workspace" &&
                  activeModule === item.module &&
                  (activeIntent ?? item.module) === itemKey;
                const Icon = item.icon;
                return (
                  <Link
                    key={itemKey}
                    to={"to" in item ? item.to : `/workspace?module=${item.module}`}
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
          {children}
          {!hideSidebar && showFooter && <Footer variant={footerVariant} />}
        </main>
      </div>

      {hideSidebar && showFooter && <Footer variant={footerVariant} />}
    </div>
  );
}
