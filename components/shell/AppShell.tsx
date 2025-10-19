"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import FabNav from "@/components/nav/FabNav";
import ExpiryBell from "@/components/nav/ExpiryBell";
import BottomNav from "@/components/nav/BottomNav";

const HIDE_CHROME_PATHS = new Set([
  "/",
  "/auth/forgot",
  "/onboarding",
]);

function shouldHideChrome(pathname: string): boolean {
  if (HIDE_CHROME_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/onboarding")) return true;
  return false;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hideChrome = shouldHideChrome(pathname);

  if (hideChrome) {
    return (
      <main className="app-shell-main bare" data-shell="bare">
        {children}
        <style jsx>{`
          .app-shell-main.bare {
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </main>
    );
  }

  return (
    <>
      <header className="ck-navbar">
        <div className="ck-navbar-inner">
          <FabNav />
          <ExpiryBell className="ck-bell-right" />
        </div>
      </header>

      <main className="container section">
        <div className="mobileNavBell">
          <ExpiryBell />
        </div>
        {children}
      </main>

      <footer className="section">
        <div className="container muted" style={{ fontSize: 12 }} />
      </footer>

      <BottomNav />
    </>
  );
}
