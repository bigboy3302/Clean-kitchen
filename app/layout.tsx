import "@/styles/globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import ThemeScript from "@/components/theme/ThemeScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import EnsureUserDoc from "@/components/auth/EnsureUserDoc";
import AuthGate from "@/components/auth/AuthGate";
import AppShell from "@/components/shell/AppShell";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          {/* Wait for auth so client SDK calls don't race before user state is known */}
          <AuthGate>
            <EnsureUserDoc />
            <AppShell>{children}</AppShell>
          </AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
