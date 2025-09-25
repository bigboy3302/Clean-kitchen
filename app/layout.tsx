// app/layout.tsx
import "@/styles/globals.css";
import type { ReactNode, Metadata } from "react";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ThemeScript from "@/components/theme/ThemeScript";
import FabNav from "@/components/nav/FabNav";

export const metadata: Metadata = { title: "Clean-Kitchen" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Set CSS vars ASAP to avoid flash */}
        <ThemeScript />

        {/* App-wide theme context */}
        <ThemeProvider>
          <header className="ck-navbar">
            <div className="ck-navbar-inner">
              <div className="ck-brand">Clean-Kitchen</div>
              <FabNav />
            </div>
          </header>

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
