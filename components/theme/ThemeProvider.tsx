"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  setPalette: (p: Palette, options?: { persist?: boolean }) => void;
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
  el.style.setProperty("--bg-raised", p.bg2);
  el.style.setProperty("--text", p.text);
  el.style.setProperty("--muted", p.muted);
  el.style.setProperty("--border", p.border);
  el.style.setProperty("--ring", p.ring);

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
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [palette, setPaletteState] = useState<Palette>(LIGHT);
  const customRef = useRef<Palette>(LIGHT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMode = (localStorage.getItem(LS_MODE) as ThemeMode) || "system";
    const savedCustom = localStorage.getItem(LS_CUSTOM);
    if (savedCustom) {
      try { customRef.current = JSON.parse(savedCustom); } catch {}
    }
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const systemPalette = mql.matches ? DARK : LIGHT;
    const initialPalette =
      savedMode === "dark" ? DARK :
      savedMode === "light" ? LIGHT :
      savedMode === "custom" ? customRef.current :
      systemPalette;

    setModeState(savedMode);
    setPaletteState(initialPalette);
    applyCssVars(initialPalette, savedMode === "system" ? (mql.matches ? "dark" : "light") : savedMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if (mode === "system") {
        const next = mql.matches ? DARK : LIGHT;
        setPaletteState(next);
      }
    };
    sync();
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const paletteForMode =
      mode === "dark" ? DARK :
      mode === "light" ? LIGHT :
      mode === "custom" ? palette :
      (mql.matches ? DARK : LIGHT);
    const themeAttr =
      mode === "system" ? (mql.matches ? "dark" : "light") :
      mode === "custom" ? "custom" :
      mode;
    applyCssVars(paletteForMode, themeAttr as any);
  }, [mode, palette]);

  const value = useMemo<Ctx>(() => ({
    mode,
    setMode: (m) => {
      setModeState(m);
      localStorage.setItem(LS_MODE, m);
      if (m === "light") {
        setPaletteState(LIGHT);
      } else if (m === "dark") {
        setPaletteState(DARK);
      } else if (m === "system") {
        const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
        setPaletteState(sys);
      } else {
        setPaletteState(customRef.current);
      }
    },
    palette,
    setPalette: (p, options) => {
      setPaletteState(p);
      const persist = options?.persist ?? mode === "custom";
      if (persist) {
        customRef.current = p;
        localStorage.setItem(LS_CUSTOM, JSON.stringify(p));
      }
    },
  }), [mode, palette]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme() must be used within <ThemeProvider>");
  return ctx;
}
