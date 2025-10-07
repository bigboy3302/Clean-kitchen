//components/pantry/HealthCoach.tsx
"use client";

import { useMemo } from "react";
import Button from "@/components/ui/button";

export type NutrientTotals = {
  sugars_g: number;
  satFat_g: number;
  sodium_g: number;
  kcal: number;
};

export type PeriodTotals = {
  title: string;
  totals: NutrientTotals;
};

type Props = {
  week: PeriodTotals;
  month: PeriodTotals;
  onViewDetails?: () => void;
};

const DAILY_TARGET = {
  sugars_g: 50,
  satFat_g: 20,
  sodium_g: 2.3,
  kcal: 2000,
};

function pct(v: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((v / max) * 100));
}

function Bar({ label, value, max, warnAt = 75 }: { label: string; value: number; max: number; warnAt?: number }) {
  const p = pct(value, max);
  const risky = p >= warnAt;
  return (
    <div className="bar">
      <div className="barTop">
        <span className="bLabel">{label}</span>
        <span className={`bVal ${risky ? "warn" : ""}`}>{value.toFixed(1)} / {max.toFixed(1)}</span>
      </div>
      <div className="track" aria-hidden>
        <div className={`fill ${risky ? "warn" : ""}`} style={{ width: `${p}%` }} />
      </div>
      <style jsx>{`
        .bar { display:grid; gap:6px; }
        .barTop { display:flex; align-items:center; justify-content:space-between; }
        .bLabel { color:var(--muted); font-weight:800; font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
        .bVal { font-weight:900; font-size:12px; }
        .bVal.warn { color:#b91c1c; }
        .track { height:8px; background: var(--bg2); border:1px solid var(--border); border-radius:999px; overflow:hidden; }
        .fill { height:100%; background: color-mix(in oklab, var(--primary) 60%, #999); }
        .fill.warn { background:#ef4444; }
      `}</style>
    </div>
  );
}

export default function HealthCoach({ week, month, onViewDetails }: Props) {
  const weeklyTargets = useMemo(() => ({
    sugars_g: DAILY_TARGET.sugars_g * 7,
    satFat_g: DAILY_TARGET.satFat_g * 7,
    sodium_g: DAILY_TARGET.sodium_g * 7,
  }), []);
  const monthlyTargets = useMemo(() => ({
    sugars_g: DAILY_TARGET.sugars_g * 30,
    satFat_g: DAILY_TARGET.satFat_g * 30,
    sodium_g: DAILY_TARGET.sodium_g * 30,
  }), []);

  return (
    <section className="coach card">
      <div className="head">
        <div>
          <div className="eyebrow">Health coach (beta)</div>
          <h3 className="title">Nutrition risk check</h3>
        </div>
        {onViewDetails ? <Button variant="secondary" onClick={onViewDetails}>View logs</Button> : null}
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panelTitle">{week.title}</div>
          <div className="stack">
            <Bar label="Sugar (g)" value={week.totals.sugars_g} max={weeklyTargets.sugars_g} />
            <Bar label="Sat. fat (g)" value={week.totals.satFat_g} max={weeklyTargets.satFat_g} />
            <Bar label="Sodium (g)" value={week.totals.sodium_g} max={weeklyTargets.sodium_g} />
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle">{month.title}</div>
          <div className="stack">
            <Bar label="Sugar (g)" value={month.totals.sugars_g} max={monthlyTargets.sugars_g} />
            <Bar label="Sat. fat (g)" value={month.totals.satFat_g} max={monthlyTargets.satFat_g} />
            <Bar label="Sodium (g)" value={month.totals.sodium_g} max={monthlyTargets.sodium_g} />
          </div>
        </div>
      </div>

      <p className="note">
        Heads-up: these are rough guides and depend on your personal needs. Talk to a healthcare professional for individualized advice.
      </p>

      <style jsx>{`
        .card { border:1px solid var(--border); background:var(--card-bg); border-radius:18px; padding:16px; box-shadow:0 14px 36px rgba(2,6,23,.06); }
        .head { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; margin-bottom:10px; }
        .eyebrow { color:var(--muted); font-size:12px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }
        .title { margin:0; font-weight:900; letter-spacing:-.01em; font-size:18px; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media (max-width:720px){ .grid{ grid-template-columns:1fr; } }
        .panel { border:1px solid var(--border); background:var(--bg); border-radius:14px; padding:12px; }
        .panelTitle { font-weight:900; margin-bottom:8px; }
        .stack { display:grid; gap:10px; }
        .note { margin:12px 0 0; color: var(--muted); font-size:12px; }
      `}</style>
    </section>
  );
}
