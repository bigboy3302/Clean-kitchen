"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import ExpiryBell from "@/components/nav/ExpiryBell";
import BottomNav from "@/components/nav/BottomNav";
import PrimaryNavbar from "@/components/nav/PrimaryNavbar";

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
      <PrimaryNavbar />

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
        .app-shell-main {
          display: grid;
          gap: 24px;
          padding-top: 32px;
          padding-bottom: max(96px, var(--bottomnav-h) + 24px);
        }
        .mobileNavBell {
          display: none;
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
          .app-shell-main {
            padding-top: 20px;
            padding-bottom: calc(var(--bottomnav-h) + 48px);
          }
          .mobileNavBell {
            display: flex;
            justify-content: center;
            position: sticky;
            top: calc(env(safe-area-inset-top) + 8px);
            z-index: 25;
            padding-bottom: 12px;
          }
          .mobileNavBell > :global(*) {
            margin: 0 auto;
          }
        }
      `}</style>
    </>
  );
}
