"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebas1e";

const GUEST_VARS: Record<string, string> = {
  "--primary": "#8b5cf6",
  "--primary-contrast": "#faf5ff",
  "--bg": "#0d0717",
  "--bg2": "#160e26",
  "--bg-raised": "#160e26",
  "--text": "#f0eaff",
  "--muted": "#a494c8",
  "--border": "#2e1d5c",
  "--ring": "#c4b5fd",
  "--bg-accent": "#8b5cf6",
  "--bg-accent-2": "#c4b5fd",
  "--btn-bg": "#8b5cf6",
  "--btn-fg": "#faf5ff",
  "--btn-border": "transparent",
  "--card-bg": "#160e26",
  "--card-border": "#2e1d5c",
};

export function GuestThemeSync() {
  const restoredRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const el = document.documentElement;

      if (!user) {
        restoredRef.current = false;
        el.setAttribute("data-theme", "custom");
        el.style.colorScheme = "dark";
        Object.entries(GUEST_VARS).forEach(([k, v]) => el.style.setProperty(k, v));
      } else if (!restoredRef.current) {
        restoredRef.current = true;
        // Clear inline vars so ThemeProvider's CSS vars take back over
        const allVars = Object.keys(GUEST_VARS);
        allVars.forEach((k) => el.style.removeProperty(k));
        // Re-apply saved theme by dispatching a storage read
        const savedMode = localStorage.getItem("theme.mode") ?? "system";
        const savedCustom = localStorage.getItem("theme.custom");
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        const LIGHT = { primary: "#9fc31b", primaryContrast: "#061006", bg: "#f6f1e8", bg2: "#fffdf8", text: "#171915", muted: "#696a61", border: "#e5dccd", ring: "#d8ff3d" };
        const DARK = { primary: "#d8ff3d", primaryContrast: "#061006", bg: "#080d0b", bg2: "#101812", text: "#fffdf2", muted: "#aeb7a7", border: "#263327", ring: "#9fc31b" };

        let p = systemDark ? DARK : LIGHT;
        if (savedMode === "dark") p = DARK;
        else if (savedMode === "light") p = LIGHT;
        else if (savedMode === "custom" && savedCustom) {
          try { p = { ...LIGHT, ...JSON.parse(savedCustom) }; } catch { /* ignore */ }
        }

        const attr = savedMode === "dark" ? "dark" : savedMode === "light" ? "light" : savedMode === "custom" ? "custom" : systemDark ? "dark" : "light";
        el.setAttribute("data-theme", attr);
        el.style.colorScheme = ["dark", "custom"].includes(attr) && p.bg < "#888888" ? "dark" : "light";

        const vars: Record<string, string> = {
          "--primary": p.primary, "--primary-contrast": p.primaryContrast,
          "--bg": p.bg, "--bg2": p.bg2, "--bg-raised": p.bg2,
          "--text": p.text, "--muted": p.muted, "--border": p.border, "--ring": p.ring,
          "--bg-accent": p.primary, "--bg-accent-2": p.ring,
          "--btn-bg": p.primary, "--btn-fg": p.primaryContrast,
          "--card-bg": p.bg2, "--card-border": p.border,
        };
        Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
      }
    });

    return unsubscribe;
  }, []);

  return null;
}
