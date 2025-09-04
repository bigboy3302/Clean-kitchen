// app/layout.tsx
import "@/styles/globals.css";
import "@/components/ui/button.css"; // if you kept this file; OK to remove if merged into globals
import type { ReactNode } from "react";

export const metadata = { title: "Clean-Kitchen" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
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
      </body>
    </html>
  );
}
