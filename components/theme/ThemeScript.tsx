
"use client";
import { useEffect } from "react";

export default function ThemeScript() {
  useEffect(() => {
    try {
      const LS_MODE = "theme.mode";
      const LS_CUSTOM = "theme.custom";
      const mode = (localStorage.getItem(LS_MODE) as any) || "system";
      const el = document.documentElement;
      const apply = (vars: Record<string, string>, dt: string) => {
        el.setAttribute("data-theme", dt);
        for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
      };
      const set = (p: any, dt: string) =>
        apply(
          {
            "--primary": p.primary,
            "--primary-contrast": p.primaryContrast,
            "--bg": p.bg,
            "--bg2": p.bg2,
            "--text": p.text,
            "--muted": p.muted,
            "--border": p.border,
            "--ring": p.ring,
            "--card-bg": p.bg2,
            "--card-border": p.border,
            "--btn-bg": p.primary,
            "--btn-fg": p.primaryContrast,
            "--btn-border": "transparent",
          },
          dt
        );

      const LIGHT = { primary:"#0f172a", primaryContrast:"#ffffff", bg:"#f8fafc", bg2:"#ffffff", text:"#0f172a", muted:"#475569", border:"#e5e7eb", ring:"#93c5fd" };
      const DARK  = { primary:"#60a5fa", primaryContrast:"#0b1220", bg:"#0b1220", bg2:"#0f1629", text:"#e5e7eb", muted:"#9aa4b2", border:"#1f2937", ring:"#2563eb" };

      if (mode === "light") set(LIGHT, "light");
      else if (mode === "dark") set(DARK, "dark");
      else if (mode === "custom") {
        const c = JSON.parse(localStorage.getItem(LS_CUSTOM) || "{}");
        set({ ...LIGHT, ...c }, "custom");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        set(prefersDark ? DARK : LIGHT, prefersDark ? "dark" : "light");
      }
    } catch {}
  }, []);
  return null;
}
