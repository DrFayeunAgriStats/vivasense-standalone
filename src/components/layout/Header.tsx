import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleHelp, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { VivaSenseUserMenu } from "@/components/vivasense/VivaSenseUserMenu";
import { mobileNav } from "./navigation";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (to: string, matchPrefix?: boolean) => {
    const [path, query] = to.split("?");
    if (matchPrefix) return location.pathname.startsWith(path);
    if (query) return location.pathname === path && location.search.includes(query);
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <Logo layout="horizontal" theme="standard" className="h-7 w-auto" />
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:inline">
              Statistical Analysis Platform
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/help"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Help</span>
            <span className="sr-only sm:hidden">Help & Learning</span>
          </Link>
          <VivaSenseUserMenu />
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-background px-3 py-3 shadow-sm md:hidden" aria-label="Mobile navigation">
          <div className="grid gap-1">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to, item.matchPrefix);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm ${
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
