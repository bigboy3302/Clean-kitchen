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
  { key: "light", label: "Clean Kitchen", hint: "Warm cream and lime" },
  { key: "dark", label: "Midnight Kitchen", hint: "Dark premium lime" }
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
  light: { primary: "#9fc31b", primaryContrast: "#061006", bg: "#f6f1e8", bg2: "#fffdf8", text: "#171915", muted: "#696a61", border: "#e5dccd", ring: "#d8ff3d" },
  dark: { primary: "#d8ff3d", primaryContrast: "#061006", bg: "#080d0b", bg2: "#101812", text: "#fffdf2", muted: "#aeb7a7", border: "#263327", ring: "#9fc31b" }
} as const;

export default function ThemePicker() {
  const { mode, setMode, palette, setPalette } = useTheme();

  const onColor = (key: keyof typeof palette) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...palette, [key]: event.target.value };
    setPalette(next, { persist: true });
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
          <h3>Theme studio</h3>
          <p className="muted">Pick a ready-made look or switch to custom and tune each color with a live preview.</p>
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
            aria-pressed={mode === item.value}
          >
            <span className="modeLabel">{item.label}</span>
            <span className="modeHint">{item.hint}</span>
          </button>
        ))}
      </div>

      <div className="presetSection">
        <div className="sectionLabel">Quick presets</div>
        <div className="presetGrid">
          {PRESETS.map((preset) => {
            const presetPalette = DEFAULTS[preset.key];
            return (
              <button
                key={preset.key}
                type="button"
                className={`presetCard ${mode === "custom" ? "customMode" : ""}`}
                onClick={() => handlePreset(preset.key)}
              >
                <div className="presetPreview" aria-hidden="true">
                  <span style={{ background: presetPalette.primary }} />
                  <span style={{ background: presetPalette.bg }} />
                  <span style={{ background: presetPalette.bg2 }} />
                  <span style={{ background: presetPalette.text }} />
                </div>
                <div className="presetText">
                  <strong>{preset.label}</strong>
                  <span>{preset.hint}</span>
                </div>
              </button>
            );
          })}
          <button type="button" className="presetCard resetCard" onClick={handleReset}>
            <div className="presetPreview resetPreview" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="presetText">
              <strong>Use system</strong>
              <span>Follow your device theme automatically</span>
            </div>
          </button>
        </div>
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
          background:
            radial-gradient(circle at top left, color-mix(in oklab, var(--primary) 10%, transparent), transparent 42%),
            linear-gradient(180deg, color-mix(in oklab, var(--bg) 92%, transparent), var(--bg2));
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 16px;
        }
        .panelHead {
          display: grid;
          gap: 8px;
        }
        .heading h3 {
          margin: 6px 0 0;
          font-size: 22px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .muted {
          color: var(--muted);
          font-size: 14px;
          margin: 6px 0 0;
          max-width: 54ch;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .presetSection {
          display: grid;
          gap: 12px;
        }
        .sectionLabel {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .presetGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        .presetCard {
          border: 1px solid var(--border);
          background: color-mix(in oklab, var(--bg) 88%, var(--bg2));
          color: var(--text);
          border-radius: 16px;
          padding: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          display: grid;
          gap: 10px;
          text-align: left;
        }
        .presetCard:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }
        .presetPreview {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .presetPreview span {
          height: 28px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }
        .presetText {
          display: grid;
          gap: 4px;
        }
        .presetText strong {
          font-size: 0.98rem;
        }
        .presetText span {
          font-size: 0.84rem;
          color: var(--muted);
          font-weight: 500;
        }
        .resetCard {
          border-style: dashed;
        }
        .resetPreview span:nth-child(1) {
          background: linear-gradient(135deg, #f8fafc, #ffffff);
        }
        .resetPreview span:nth-child(2) {
          background: linear-gradient(135deg, #0b1220, #0f1629);
        }
        .resetPreview span:nth-child(3) {
          background: linear-gradient(135deg, #60a5fa, #93c5fd);
        }
        .resetPreview span:nth-child(4) {
          background: linear-gradient(135deg, #e2e8f0, #94a3b8);
        }
        .modeGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        .mode {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 12px 14px;
          background: color-mix(in oklab, var(--bg) 90%, var(--bg2));
          text-align: left;
          display: grid;
          gap: 4px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .mode.active {
          border-color: var(--primary);
          background: linear-gradient(180deg, color-mix(in oklab, var(--primary) 14%, var(--bg)), color-mix(in oklab, var(--bg) 92%, var(--bg2)));
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
          grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
          gap: 8px;
        }
        .swatch {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px 10px;
          background: color-mix(in oklab, var(--bg2) 94%, var(--bg));
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .swatchColor {
          width: 20px;
          height: 20px;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
        }
        .swatchLabel {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }
        @media (max-width: 640px) {
          .panel {
            padding: 16px 14px;
          }
          .presetGrid {
            grid-template-columns: 1fr;
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
          gap: 6px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: color-mix(in oklab, var(--bg) 90%, var(--bg2));
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
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: color-mix(in oklab, var(--bg2) 94%, var(--bg));
        }
        input {
          width: 42px;
          height: 28px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg);
          padding: 0;
          cursor: pointer;
        }
        .pickerCode {
          font-family: "Courier New", monospace;
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
        }
      `}</style>
    </label>
  );
}
