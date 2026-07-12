import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FlaskConical, Dna, Sparkles, Leaf } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
  footerVariant?: "default" | "minimal-vivasense";
  hideSidebar?: boolean;
}

const nav = [
  { to: "/workspace", label: "Research Workspace", icon: Leaf },
] as const;

const modules = [
  { to: "/modules/experimental-design", label: "Experimental Design", icon: FlaskConical },
  { to: "/modules/genetics-breeding", label: "Genetics & Breeding", icon: Dna },
  { to: "/modules/advanced-analytics", label: "Advanced Analytics", icon: Sparkles },
] as const;

export function Layout({ children, footerVariant = "minimal-vivasense", hideSidebar = false }: LayoutProps) {
  const pathname = useLocation().pathname;

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
                const active = pathname.startsWith(item.to.split("/").slice(0, 3).join("/"));
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
          </aside>
        )}

        <main className="min-w-0 flex-1 flex flex-col">
          {children}
          {!hideSidebar && <Footer variant={footerVariant} />}
        </main>
      </div>

      {hideSidebar && <Footer variant={footerVariant} />}
    </div>
  );
}
