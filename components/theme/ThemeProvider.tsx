"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  setMode: (m: ThemeMode, options?: { palette?: Palette; persistCustom?: boolean }) => void;
  palette: Palette;
  setPalette: (p: Palette, options?: { persist?: boolean }) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const LS_MODE = "theme.mode";
const LS_CUSTOM = "theme.custom";

function applyCssVars(p: Palette, dataTheme: "light" | "dark" | "custom") {
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
  el.style.colorScheme = isDark ? "dark" : "light";
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
  const modeRef = useRef<ThemeMode>("system");
  const mqlRef = useRef<MediaQueryList | null>(null);

  const readSystemPrefersDark = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (!mqlRef.current) {
      mqlRef.current = window.matchMedia("(prefers-color-scheme: dark)");
    }
    return !!mqlRef.current.matches;
  }, []);

  const applyForMode = useCallback((targetMode: ThemeMode, paletteOverride?: Palette) => {
    const systemIsDark = readSystemPrefersDark();
    const paletteForMode =
      targetMode === "dark"
        ? DARK
        : targetMode === "light"
        ? LIGHT
        : targetMode === "custom"
        ? paletteOverride ?? customRef.current
        : systemIsDark
        ? DARK
        : LIGHT;

    const attr: "light" | "dark" | "custom" =
      targetMode === "system"
        ? systemIsDark
          ? "dark"
          : "light"
        : targetMode === "custom"
        ? "custom"
        : targetMode;

    setPaletteState(paletteForMode);
    if (typeof window !== "undefined") {
      applyCssVars(paletteForMode, attr);
    }
  }, [readSystemPrefersDark]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mqlRef.current = mql;

    const savedMode = (localStorage.getItem(LS_MODE) as ThemeMode) || "system";
    const savedCustom = localStorage.getItem(LS_CUSTOM);
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom) as Palette;
        if (parsed && typeof parsed === "object") {
          customRef.current = { ...LIGHT, ...parsed };
        }
      } catch {
        // ignore parse issues
      }
    }
    const systemPalette = mql.matches ? DARK : LIGHT;
    const initialPalette =
      savedMode === "dark"
        ? DARK
        : savedMode === "light"
        ? LIGHT
        : savedMode === "custom"
        ? customRef.current
        : systemPalette;

    modeRef.current = savedMode;
    setModeState(savedMode);
    setPaletteState(initialPalette);
    const attr: "light" | "dark" | "custom" =
      savedMode === "system"
        ? mql.matches
          ? "dark"
          : "light"
        : savedMode === "custom"
        ? "custom"
        : savedMode;
    applyCssVars(initialPalette, attr);

    const handleSystem = (event: MediaQueryListEvent) => {
      if (modeRef.current !== "system") return;
      const nextPalette = event.matches ? DARK : LIGHT;
      setPaletteState(nextPalette);
      applyCssVars(nextPalette, event.matches ? "dark" : "light");
    };

    mql.addEventListener?.("change", handleSystem);
    return () => mql.removeEventListener?.("change", handleSystem);
  }, []);

  const value = useMemo<Ctx>(() => ({
    mode,
    setMode: (nextMode, options) => {
      modeRef.current = nextMode;
      setModeState(nextMode);
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_MODE, nextMode);
      }

      let customPalette = customRef.current;
      if (options?.palette) {
        customPalette = { ...LIGHT, ...options.palette };
        customRef.current = customPalette;
        const shouldPersist = options.persistCustom ?? true;
        if (shouldPersist && typeof window !== "undefined") {
          localStorage.setItem(LS_CUSTOM, JSON.stringify(customPalette));
        }
      }

      applyForMode(nextMode, customPalette);
    },
    palette,
    setPalette: (p, options) => {
      const nextPalette: Palette = { ...p };
      const persist = options?.persist ?? modeRef.current === "custom";
      if (modeRef.current === "custom" || persist) {
        customRef.current = nextPalette;
      }
      if (persist && typeof window !== "undefined") {
        localStorage.setItem(LS_CUSTOM, JSON.stringify(customRef.current));
      }

      setPaletteState(nextPalette);

      if (typeof window !== "undefined") {
        const systemIsDark = readSystemPrefersDark();
        const activeMode = modeRef.current;
        const attr: "light" | "dark" | "custom" =
          activeMode === "system"
            ? systemIsDark
              ? "dark"
              : "light"
            : activeMode === "custom"
            ? "custom"
            : activeMode;
        const paletteToApply =
          activeMode === "custom"
            ? nextPalette
            : activeMode === "dark"
            ? DARK
            : activeMode === "light"
            ? LIGHT
            : systemIsDark
            ? DARK
            : LIGHT;
        applyCssVars(paletteToApply, attr);
      }
    },
  }), [mode, palette, applyForMode, readSystemPrefersDark]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const systemIsDark = readSystemPrefersDark();
    const paletteForMode =
      mode === "custom"
        ? palette
        : mode === "dark"
        ? DARK
        : mode === "light"
        ? LIGHT
        : systemIsDark
        ? DARK
        : LIGHT;
    const attr: "light" | "dark" | "custom" =
      mode === "system"
        ? systemIsDark
          ? "dark"
          : "light"
        : mode === "custom"
        ? "custom"
        : mode;
    applyCssVars(paletteForMode, attr);
  }, [mode, palette, readSystemPrefersDark]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme() must be used within <ThemeProvider>");
  return ctx;
}
