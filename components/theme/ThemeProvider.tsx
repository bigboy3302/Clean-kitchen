/* components/theme/ThemeProvider.tsx */
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "system" | "light" | "dark" | "custom";
export type Palette = {
  primary: string;
  primaryContrast: string;
  bg: string;
  bg2: string;
  text: string;
  muted: string;
  border: string;
  ring: string;
};

const LIGHT: Palette = {
  primary: "#0f172a",
  primaryContrast: "#ffffff",
  bg: "#f8fafc",
  bg2: "#ffffff",
  text: "#0f172a",
  muted: "#475569",
  border: "#e5e7eb",
  ring: "#93c5fd",
};

const DARK: Palette = {
  primary: "#60a5fa",
  primaryContrast: "#0b1220",
  bg: "#0b1220",
  bg2: "#0f1629",
  text: "#e5e7eb",
  muted: "#9aa4b2",
  border: "#1f2937",
  ring: "#2563eb",
};

type Ctx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
  apply: (m?: ThemeMode, p?: Palette) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const LS_MODE = "theme.mode";
const LS_CUSTOM = "theme.custom";

function applyCssVars(p: Palette, dataTheme?: "light" | "dark" | "custom") {
  const el = document.documentElement;
  if (dataTheme) el.setAttribute("data-theme", dataTheme);
  el.style.setProperty("--primary", p.primary);
  el.style.setProperty("--primary-contrast", p.primaryContrast);
  el.style.setProperty("--bg", p.bg);
  el.style.setProperty("--bg2", p.bg2);
  el.style.setProperty("--text", p.text);
  el.style.setProperty("--muted", p.muted);
  el.style.setProperty("--border", p.border);
  el.style.setProperty("--ring", p.ring);

  // extra tokens used by components
  el.style.setProperty("--card-bg", p.bg2);
  el.style.setProperty("--card-border", p.border);
  el.style.setProperty("--btn-bg", p.primary);
  el.style.setProperty("--btn-fg", p.primaryContrast);
  el.style.setProperty("--btn-border", "transparent");

  const isDark = dataTheme === "dark" || (dataTheme === "custom" && isPerceivedDark(p));
  el.style.colorScheme = isDark ? ("dark" as any) : ("light" as any);
}

function isPerceivedDark(p: Palette) {
  const [r, g, b] = hexToRgb(p.bg);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 140;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [palette, setPalette] = useState<Palette>(LIGHT);

  useEffect(() => {
    const savedMode = (localStorage.getItem(LS_MODE) as ThemeMode) || "system";
    setMode(savedMode);
    let pal = LIGHT;
    const savedCustom = localStorage.getItem(LS_CUSTOM);
    if (savedCustom) {
      try { pal = JSON.parse(savedCustom); } catch {}
    }
    setPalette(savedMode === "dark" ? DARK : savedMode === "custom" ? pal : LIGHT);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const sys = mql.matches ? DARK : LIGHT;
    const active =
      savedMode === "dark" ? DARK : savedMode === "light" ? LIGHT : savedMode === "custom" ? pal : sys;
    applyCssVars(active, savedMode === "system" ? (mql.matches ? "dark" : "light") : (savedMode as any));

    const onChange = () => {
      if (savedMode === "system") {
        const now = mql.matches ? DARK : LIGHT;
        applyCssVars(now, mql.matches ? "dark" : "light");
      }
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const apply = (m = mode, p = palette) => {
    localStorage.setItem(LS_MODE, m);
    if (m === "custom") localStorage.setItem(LS_CUSTOM, JSON.stringify(p));
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    if (m === "system") {
      applyCssVars(mql.matches ? DARK : LIGHT, mql.matches ? "dark" : "light");
    } else if (m === "light") {
      applyCssVars(LIGHT, "light");
    } else if (m === "dark") {
      applyCssVars(DARK, "dark");
    } else {
      applyCssVars(p, "custom");
    }
  };

  const value = useMemo<Ctx>(
    () => ({
      mode,
      setMode: (m) => { setMode(m); apply(m); },
      palette,
      setPalette: (p) => { setPalette(p); if (mode === "custom") apply("custom", p); },
      apply
    }),
    [mode, palette]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme() must be used within <ThemeProvider>");
  return ctx;
}
