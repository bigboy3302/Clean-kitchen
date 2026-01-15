"use client";

import React from "react";
import { MotionMode, useMotionSettings } from "./MotionSettingsProvider";

const options: { key: MotionMode; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "subtle", label: "Subtle" },
  { key: "dynamic", label: "Dynamic" },
];

export default function BackgroundMotionControl() {
  const { mode, setMode, reducedMotion } = useMotionSettings();

  return (
    <div className="motionControl">
      <span className="motionLabel">Background motion</span>

      <div className="motionOptions" role="group" aria-label="Background motion">
        {options.map((o) => {
          const active = mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setMode(o.key)}
              className={`motionOption ${active ? "is-active" : ""}`}
              aria-pressed={active}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {reducedMotion && (
        <span className="motionNote">(reduced motion enabled)</span>
      )}
    </div>
  );
}
