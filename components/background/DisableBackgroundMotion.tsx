"use client";

import { useEffect, useRef } from "react";
import { useMotionSettings, type MotionMode } from "@/components/background/MotionSettingsProvider";

export default function DisableBackgroundMotion() {
  const { mode, setMode } = useMotionSettings();
  const initialMode = useRef<MotionMode | null>(null);

  if (initialMode.current === null) {
    initialMode.current = mode;
  }

  useEffect(() => {
    setMode("off");
    document.documentElement.dataset.bgLock = "true";

    return () => {
      delete document.documentElement.dataset.bgLock;
      setMode(initialMode.current ?? "subtle");
    };
  }, [setMode]);

  return null;
}
