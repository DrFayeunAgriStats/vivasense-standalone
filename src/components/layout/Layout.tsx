import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
  footerVariant?: "default" | "minimal-vivasense";
}

export function Layout({ children, footerVariant = "minimal-vivasense" }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-[73px]">{children}</main>
      <Footer variant={footerVariant} />
    </div>
  );
}
