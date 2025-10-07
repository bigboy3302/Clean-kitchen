import "@/styles/globals.css";
import type { ReactNode } from "react";
import ThemeScript from "@/components/theme/ThemeScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import FabNav from "@/components/nav/FabNav";
import EnsureUserDoc from "@/components/auth/EnsureUserDoc";
import BottomNav from "@/components/nav/BottomNav";
export const metadata = {
  title: "Clean Kitchen",
  description: "Plan, cook, and enjoy.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeScript />
        <ThemeProvider>
          <EnsureUserDoc />
          <header className="ck-navbar">
            <div className="ck-navbar-inner">
              <div aria-hidden />
              <FabNav />
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
