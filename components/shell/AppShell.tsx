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

      <main className="app-shell-main container section">
        <div className="mobileNavBell">
          <ExpiryBell />
        </div>
        {children}
      </main>

      <footer className="section">
        <div className="container muted" style={{ fontSize: 12 }} />
      </footer>

      <BottomNav />

      <style jsx>{`
        .ck-navbar {
          position: sticky;
          top: 0;
          z-index: 95;
          padding: 12px 0 4px;
          background: linear-gradient(
            180deg,
            color-mix(in oklab, var(--bg) 96%, transparent) 0%,
            color-mix(in oklab, var(--bg) 86%, transparent) 100%
          );
          backdrop-filter: blur(16px);
        }
        .ck-navbar-inner {
          width: min(1120px, 100%);
          margin: 0 auto;
          padding: 0 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
        }
        .app-shell-main {
          display: grid;
          gap: 24px;
          padding-top: 32px;
          padding-bottom: max(96px, var(--bottomnav-h) + 24px);
        }
        .mobileNavBell {
          display: none;
        }
        .mobileNavBell > :global(*) {
          margin-left: auto;
        }
        footer.section {
          padding-top: 12px;
          padding-bottom: 48px;
        }
        footer .container {
          display: flex;
          justify-content: flex-end;
        }
        @media (max-width: 768px) {
          .ck-navbar {
            background: transparent;
            padding: 8px 0;
          }
          .ck-navbar-inner {
            padding-inline: 12px;
          }
          .app-shell-main {
            padding-top: 20px;
            padding-bottom: calc(var(--bottomnav-h) + 48px);
          }
          .mobileNavBell {
            display: flex;
            justify-content: flex-end;
            position: sticky;
            top: calc(env(safe-area-inset-top) + 8px);
            z-index: 25;
          }
        }
      `}</style>
    </>
  );
}
