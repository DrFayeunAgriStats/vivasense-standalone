import { Link } from "react-router-dom";
import { CircleHelp, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { advancedBetaEnabled } from "@/lib/advancedRelease";
import { VivaSenseUserMenu } from "@/components/vivasense/VivaSenseUserMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
      <Link to="/" className="flex items-center gap-2.5">
        <Logo layout="horizontal" theme="standard" className="h-7 w-auto" />
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:inline">
          Statistical Analysis Platform
        </span>
      </Link>
      {/* Account menu with Sign Out — replaces the previously static avatar so
          users can log out and return to /auth to sign in again. */}
      <div className="flex items-center gap-1.5">
        {advancedBetaEnabled && (
          <Link
            to="/workspace?module=advanced"
            data-testid="header-advanced-analytics"
            title="Advanced Analytics — PCA, Stability, AMMI and GGE (Experimental Beta)"
            aria-label="Open Advanced Analytics — Experimental Beta"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Advanced <span className="text-xs text-muted-foreground">(Beta)</span></span>
          </Link>
        )}
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
    </header>
  );
}
