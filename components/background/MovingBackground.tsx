"use client";

import React from "react";
import { useMotionSettings } from "./MotionSettingsProvider";

export default function MovingBackground() {
  const { mode, reducedMotion } = useMotionSettings();
  const resolvedMode = reducedMotion ? "off" : mode;

  return (
    <div className={`ck-bg ck-bg--${resolvedMode}`} aria-hidden="true">
      <div className="ck-bg__layer ck-bg__layer--one" />
      <div className="ck-bg__layer ck-bg__layer--two" />
      <div className="ck-bg__waves" />
      <div className="ck-bg__blob ck-bg__blob--a" />
      <div className="ck-bg__blob ck-bg__blob--b" />
      <div className="ck-bg__blob ck-bg__blob--c" />
      <div className="ck-bg__grain" />
    </div>
  );
}
