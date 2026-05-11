import "@/styles/globals.css";
import "@/styles/clean-kitchen-theme.css";
import "@/styles/clean-kitchen-pages.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import ThemeScript from "@/components/theme/ThemeScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import EnsureUserDoc from "@/components/auth/EnsureUserDoc";
import ProfileCompletionModal from "@/components/auth/ProfileCompletionModal";
import AuthGate from "@/components/auth/AuthGate";
import AppShell from "@/components/shell/AppShell";
import AuthModal from "@/components/auth/AuthModal";
import BackgroundPortal from "@/components/background/BackgroundPortal";
import { MotionSettingsProvider } from "../components/background/MotionSettingsProvider";
import { AuthModalProvider } from "@/context/AuthModalContext";
import { GuestThemeSync } from "@/components/theme/GuestThemeSync";
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
        <MotionSettingsProvider>
          <BackgroundPortal />
          <div className="appRoot">
            <ThemeProvider>
              <AuthModalProvider>
                {/* Wait for auth so client SDK calls don't race before user state is known */}
                <GuestThemeSync />
                <AuthGate>
                  <EnsureUserDoc />
                  <ProfileCompletionModal />
                  <AppShell>{children}</AppShell>
                </AuthGate>
                <AuthModal />
              </AuthModalProvider>
            </ThemeProvider>
          </div>
        </MotionSettingsProvider>
      </body>
    </html>
  );
}
