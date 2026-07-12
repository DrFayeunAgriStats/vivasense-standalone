import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, FlaskConical } from "lucide-react";
import { VivaSenseUserMenu } from "@/components/vivasense/VivaSenseUserMenu";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <nav className="container-wide flex items-center justify-between py-4" ref={navRef}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif font-semibold text-base text-foreground">
              VivaSense
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
              Statistical Workspace
            </span>
          </div>
        </Link>

        {/* Desktop: Spacer */}
        <div className="hidden lg:block flex-1" />

        {/* Desktop: User Menu */}
        <div className="hidden lg:flex items-center gap-2">
          <VivaSenseUserMenu />
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile: User Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-background border-b border-border py-2 px-4">
          <VivaSenseUserMenu />
        </div>
      )}
    </header>
  );
}
