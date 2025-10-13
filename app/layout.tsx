import "@/styles/globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import ThemeScript from "@/components/theme/ThemeScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import FabNav from "@/components/nav/FabNav";
import ExpiryBell from "@/components/nav/ExpiryBell";
import EnsureUserDoc from "@/components/auth/EnsureUserDoc";
import BottomNav from "@/components/nav/BottomNav";
import "@/lib/firestoreDebug";
export const metadata: Metadata = {
  title: "Clean Kitchen",
  description: "Plan, cook, and enjoy.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <EnsureUserDoc />
          <header className="ck-navbar">
            <div className="ck-navbar-inner">
              {/* Put nav first (left) */}
              <FabNav />
              {/* Put bell second (right) */}
              <ExpiryBell className="ck-bell-right" />
            </div>
          </header>

          <main className="container section">{children}</main>

          <footer className="section">
            <div className="container muted" style={{ fontSize: 12 }} />
          </footer>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
