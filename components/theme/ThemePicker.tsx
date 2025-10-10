"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";

const MODE_META = [
  { value: "system", label: "System", hint: "Match device settings" },
  { value: "light", label: "Light", hint: "Bright workspace" },
  { value: "dark", label: "Dark", hint: "Low-light friendly" },
  { value: "custom", label: "Custom", hint: "Pick your palette" }
] as const;

const PRESETS = [
  { key: "light", label: "Light preset" },
  { key: "dark", label: "Dark preset" }
] as const;

const COLOR_KEYS = [
  { key: "primary", label: "Primary" },
  { key: "primaryContrast", label: "On primary" },
  { key: "bg", label: "Background" },
  { key: "bg2", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "border", label: "Border" },
  { key: "ring", label: "Focus ring" }
] as const;

const DEFAULTS = {
  light: { primary: "#0f172a", primaryContrast: "#ffffff", bg: "#f8fafc", bg2: "#ffffff", text: "#0f172a", muted: "#475569", border: "#e5e7eb", ring: "#93c5fd" },
  dark: { primary: "#60a5fa", primaryContrast: "#0b1220", bg: "#0b1220", bg2: "#0f1629", text: "#e5e7eb", muted: "#9aa4b2", border: "#1f2937", ring: "#2563eb" }
} as const;

export default function ThemePicker() {
  const { mode, setMode, palette, setPalette } = useTheme();

  const onColor = (key: keyof typeof palette) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...palette, [key]: event.target.value };
    setPalette(next);
  };

  const handlePreset = (key: typeof PRESETS[number]["key"]) => {
    const preset = DEFAULTS[key];
    setPalette(preset, { persist: true });
    setMode("custom");
  };

  const handleReset = () => {
    setMode("system");
  };

  return (
    <section className="panel">
      <div className="panelHead">
        <div className="heading">
          <p className="eyebrow">Appearance</p>
          <h3>Theme controls</h3>
          <p className="muted">Swap between presets or fine tune the colors to match your kitchen vibe.</p>
        </div>
        <div className="actions">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="preset"
              onClick={() => handlePreset(preset.key)}
            >
              {preset.label}
            </button>
          ))}
          <button type="button" className="preset reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="modeGrid">
        {MODE_META.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`mode ${mode === item.value ? "active" : ""}`}
            onClick={() => setMode(item.value)}
            title={item.label}
          >
            <span className="modeLabel">{item.label}</span>
            <span className="modeHint">{item.hint}</span>
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <>
          <div className="swatchRow">
            {COLOR_KEYS.map((entry) => (
              <div key={entry.key} className="swatch">
                <span className="swatchColor" style={{ background: palette[entry.key] }} />
                <span className="swatchLabel">{entry.label}</span>
              </div>
            ))}
          </div>
          <div className="grid">
            {COLOR_KEYS.map((entry) => (
              <Picker
                key={entry.key}
                label={entry.label}
                value={palette[entry.key]}
                onChange={onColor(entry.key)}
              />
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .panel {
          border: 1px solid var(--border);
          background: linear-gradient(180deg, color-mix(in oklab, var(--bg) 92%, transparent), var(--bg2));
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 20px;
        }
        .panelHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .heading h3 {
          margin: 6px 0 0;
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
          margin: 6px 0 0;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .preset {
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          border-radius: 999px;
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.18s ease;
        }
        .preset:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }
        .preset.reset {
          color: #b91c1c;
          border-color: color-mix(in oklab, #ef4444 40%, transparent);
        }
        .modeGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .mode {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 16px;
          background: var(--bg);
          text-align: left;
          display: grid;
          gap: 6px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .mode.active {
          border-color: var(--primary);
          background: color-mix(in oklab, var(--primary) 12%, var(--bg));
          box-shadow: 0 16px 34px rgba(37, 99, 235, 0.18);
          transform: translateY(-2px);
        }
        .modeLabel {
          font-weight: 700;
          color: var(--text);
          text-transform: capitalize;
        }
        .modeHint {
          font-size: 12px;
          color: var(--muted);
        }
        .swatchRow {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }
        .swatch {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 10px 12px;
          background: var(--bg2);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .swatchColor {
          width: 28px;
          height: 28px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
        }
        .swatchLabel {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .panel {
            padding: 18px 16px;
          }
          .modeGrid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
        }
      `}</style>
    </section>
  );
}

function Picker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="picker">
      <span className="pickerLabel">{label}</span>
      <div className="pickerControl">
        <input type="color" value={value} onChange={onChange} aria-label={`${label} color`} />
        <span className="pickerCode">{value.toUpperCase()}</span>
      </div>

      <style jsx>{`
        .picker {
          display: grid;
          gap: 8px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--bg);
        }
        .pickerLabel {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .pickerControl {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg2);
        }
        input {
          width: 48px;
          height: 32px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg);
          padding: 0;
          cursor: pointer;
        }
        .pickerCode {
          font-family: "Courier New", monospace;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
      `}</style>
    </label>
  );
}
