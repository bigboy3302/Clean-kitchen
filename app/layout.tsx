// app/layout.tsx
import "@/styles/globals.css";
import "@/components/ui/button.css";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ThemeScript from "@/components/theme/ThemeScript";

export const metadata = { title: "Clean-Kitchen" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* set CSS variables ASAP to avoid flash */}
        <ThemeScript />

        {/* theme context for the whole app */}
        <ThemeProvider>
          <header className="navbar">
            <div className="navbar-inner">
              <div className="nav-brand">Clean-Kitchen</div>
              <nav className="nav-links">
                <a className="nav-link" href="/dashboard">Dashboard</a>
                <a className="nav-link" href="/pantry">Pantry</a>
                <a className="nav-link" href="/recipes">Recipes</a>
                <a className="nav-link" href="/fitness">Fitness</a>
                <a className="nav-link" href="/profile">Profile</a>
              </nav>
            </div>
          </header>

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
