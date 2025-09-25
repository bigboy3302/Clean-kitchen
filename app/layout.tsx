// app/layout.tsx
import "@/styles/globals.css";
import type { ReactNode } from "react";
import ThemeScript from "@/components/theme/ThemeScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import FabNav from "@/components/nav/FabNav";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeScript />
        <ThemeProvider>
          <header className="ck-navbar">
            <div className="ck-navbar-inner">
              <div className="ck-brand">Clean-Kitchen</div>
              <FabNav /> {/* ← keep this only */}
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
