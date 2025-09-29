
"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemePicker() {
  const { mode, setMode, palette, setPalette, apply } = useTheme();

  const onColor = (key: keyof typeof palette) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPalette({ ...palette, [key]: e.target.value });
  };

  return (
    <div className="tp">
      <div className="row">
        {(["system", "light", "dark", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${mode === m ? "on" : ""}`}
            onClick={() => setMode(m)}
            title={m}
          >
            {m}
          </button>
        ))}
        <button className="chip" onClick={() => { setPalette(DEFAULTS[mode] || DEFAULTS.light); apply("custom", DEFAULTS.light); }}>
          Reset
        </button>
      </div>

      {mode === "custom" && (
        <div className="grid">
          <Picker label="Primary" value={palette.primary} onChange={onColor("primary")} />
          <Picker label="On primary" value={palette.primaryContrast} onChange={onColor("primaryContrast")} />
          <Picker label="Background" value={palette.bg} onChange={onColor("bg")} />
          <Picker label="Surface" value={palette.bg2} onChange={onColor("bg2")} />
          <Picker label="Text" value={palette.text} onChange={onColor("text")} />
          <Picker label="Muted" value={palette.muted} onChange={onColor("muted")} />
          <Picker label="Border" value={palette.border} onChange={onColor("border")} />
          <Picker label="Focus ring" value={palette.ring} onChange={onColor("ring")} />
        </div>
      )}

      <style jsx>{`
        .tp{display:grid;gap:10px}
        .row{display:flex;gap:8px;flex-wrap:wrap}
        .chip{border:1px solid var(--border);background:var(--bg2);color:var(--text);border-radius:999px;padding:6px 10px;cursor:pointer}
        .chip.on{background:var(--primary);color:var(--primary-contrast);border-color:transparent}
        .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        @media (max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
        @media (max-width:560px){.grid{grid-template-columns:1fr;}}
      `}</style>
    </div>
  );
}

const DEFAULTS = {
  light: { primary:"#0f172a", primaryContrast:"#ffffff", bg:"#f8fafc", bg2:"#ffffff", text:"#0f172a", muted:"#475569", border:"#e5e7eb", ring:"#93c5fd" },
  dark:  { primary:"#60a5fa", primaryContrast:"#0b1220", bg:"#0b1220", bg2:"#0f1629", text:"#e5e7eb", muted:"#9aa4b2", border:"#1f2937", ring:"#2563eb" },
  system: null as any, custom: null as any
};

function Picker({
  label, value, onChange,
}: { label: string; value: string; onChange: (e: any) => void }) {
  return (
    <label className="pc">
      <span>{label}</span>
      <input type="color" value={value} onChange={onChange} />
      <style jsx>{`
        .pc{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border);background:var(--bg2);padding:8px 10px;border-radius:12px}
        span{color:var(--text)}
        input{width:42px;height:28px;border:1px solid var(--border);border-radius:8px;background:var(--bg)}
      `}</style>
    </label>
  );
}
