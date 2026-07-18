import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { VivaSenseUserMenu } from "@/components/vivasense/VivaSenseUserMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <Sprout className="h-4 w-4" />
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">VivaSense</span>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:inline">
            Statistical Analysis Platform
          </span>
        </div>
      </Link>
      {/* Account menu with Sign Out — replaces the previously static avatar so
          users can log out and return to /auth to sign in again. */}
      <VivaSenseUserMenu />
    </header>
  );
}
