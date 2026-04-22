"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/nav/Sidebar";
import TopBar from "@/components/nav/TopBar";

const HIDE_CHROME_PATHS = new Set([
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  if (hideChrome) {
    return (
      <main className="shell-bare" data-shell="bare">
        {children}
        <style jsx>{`
          .shell-bare {
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
      <Sidebar mobileOpen={mobileNavOpen} onRequestClose={() => setMobileNavOpen(false)} />

      <div className="shell-body">
        <TopBar mobileNavOpen={mobileNavOpen} onOpenMobileNav={() => setMobileNavOpen((open) => !open)} />

        <main className="shell-main">{children}</main>

        <footer className="shell-footer">
          <span>© 2026 Clean Kitchen. All rights reserved.</span>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/support">Help &amp; Support</a>
          <a href="mailto:adriansraitums95@gmail.com">adriansraitums95@gmail.com</a>
        </footer>
      </div>

      <style jsx>{`
        .shell-body {
          margin-left: 278px;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .shell-main {
          flex: 1;
          min-width: 0;
          padding: 0;
        }

        .shell-footer {
          padding: 20px 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: var(--muted);
          border-top: 1px solid var(--border);
          background: color-mix(in oklab, var(--bg) 94%, transparent);
        }

        .shell-footer a {
          color: var(--muted);
          text-decoration: none;
          transition: color 0.14s ease;
        }

        .shell-footer a:hover {
          color: var(--text);
        }

        @media (max-width: 768px) {
          .shell-body {
            margin-left: 0;
          }

          .shell-main {
            padding-bottom: 18px;
          }

          .shell-footer {
            padding: 18px 16px 24px;
            gap: 12px;
            font-size: 11.5px;
          }
        }
      `}</style>
    </>
  );
}
