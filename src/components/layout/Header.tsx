import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
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
      <VivaSenseUserMenu />
    </header>
  );
}
