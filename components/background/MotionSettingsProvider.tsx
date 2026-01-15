"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type MotionMode = "off" | "subtle" | "dynamic";

type MotionContextValue = {
  mode: MotionMode;
  setMode: (mode: MotionMode) => void;
  reducedMotion: boolean;
};

const MotionContext = createContext<MotionContextValue | null>(null);

const STORAGE_KEY = "ck:bg-motion";

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function MotionSettingsProvider({ children }: { children: React.ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mode, setModeState] = useState<MotionMode>("subtle");

  useEffect(() => {
    const rm = getPrefersReducedMotion();
    setReducedMotion(rm);

    // Load saved mode (client-only)
    const saved = (localStorage.getItem(STORAGE_KEY) as MotionMode | null) ?? null;

    if (saved === "off" || saved === "subtle" || saved === "dynamic") {
      setModeState(saved);
    } else {
      setModeState("subtle");
    }

    // Keep reduced-motion in sync if user changes OS setting while page is open
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      const nextRm = !!mql?.matches;
      setReducedMotion(nextRm);
      if (nextRm) setModeState("off");
    };
    mql?.addEventListener?.("change", onChange);
    return () => mql?.removeEventListener?.("change", onChange);
  }, []);

  const setMode = (next: MotionMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ mode, setMode, reducedMotion }), [mode, reducedMotion]);

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionSettings() {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error("useMotionSettings must be used within MotionSettingsProvider");
  return ctx;
}
