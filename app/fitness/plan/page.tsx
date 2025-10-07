"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import {
  getWeekPlan, upsertDayItem, toggleDone, getMetrics,
  weekIdFromDate, type WeekPlan, type WorkoutItem, type DayKey, suggestMeals, type SuggestedMeal
} from "@/lib/fitness/store";

type Exercise = {
  id: string; name: string; bodyPart: string; target: string; equipment: string; gifUrl: string;
};

const dayKeys: DayKey[] = ["mon","tue","wed","thu","fri","sat","sun"];
const dayNames: Record<DayKey,string> = { mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat",sun:"Sun" };
const cap = (s:string)=>s? s[0].toUpperCase()+s.slice(1):s;
const gif = (id: string, res=180) => `/api/workouts/gif?id=${encodeURIComponent(id)}&res=${res}`;

export default function WeeklyPlan() {
  const [weekId, setWeekId] = useState(weekIdFromDate());
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(true);
  const [goal, setGoal] = useState<"bulk"|"cut"|"maintain">("maintain");
  const [mealMap, setMealMap] = useState<Record<DayKey, SuggestedMeal[]>>({mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]});
  const [exCache, setExCache] = useState<Record<string, Exercise | null>>({}); // name -> first match

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const m = await getMetrics().catch(()=>null);
        if (m?.goal) setGoal(m.goal);
        const wk = await getWeekPlan(weekId);
        setPlan(wk);

        // get 14 suggestions and assign two per day
        const suggestions = await suggestMeals(m?.goal ?? "maintain", 20);
        const perDay: Record<DayKey, SuggestedMeal[]> = {mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]};
        let idx = 0;
        dayKeys.forEach(k=>{
          perDay[k] = suggestions.slice(idx, idx+2);
          idx += 2;
        });
        setMealMap(perDay);

        // warmup: fetch one GIF per first item name (if present)
        const names = dayKeys.flatMap(k => (wk.days[k]?.items?.[0]?.name ? [wk.days[k].items[0].name] : []));
        const map: Record<string, Exercise | null> = {};
        await Promise.all(names.map(async (nm) => {
          try {
            const r = await fetch(`/api/workouts?q=${encodeURIComponent(nm)}&limit=1`, { cache: "no-store" });
            const js = await r.json();
            map[nm] = Array.isArray(js) && js[0] ? js[0] : null;
          } catch { map[nm] = null; }
        }));
        setExCache(map);
      } finally {
        setBusy(false);
      }
    })();
  }, [weekId]);

  const title = useMemo(() => {
    const [y, w] = weekId.split("-W");
    return `Week ${w}, ${y}`;
  }, [weekId]);

  async function addItem(day: DayKey) {
    if (!plan) return;
    const name = prompt("Workout name (e.g., Push day, Squat 5x5, HIIT 20m)");
    if (!name) return;
    const item: WorkoutItem = { id: crypto.randomUUID(), name, done: false };
    setBusy(true);
    await upsertDayItem(plan.weekId, day, item);
    const next = await getWeekPlan(plan.weekId);
    setPlan(next);
    setBusy(false);
  }

  async function setDone(day: DayKey, id: string, done: boolean) {
    if (!plan) return;
    setBusy(true);
    await toggleDone(plan.weekId, day, id, done);
    const next = await getWeekPlan(plan.weekId);
    setPlan(next);
    setBusy(false);
  }

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1 className="title">Weekly plan</h1>
          <div className="muted">{title}</div>
        </div>
        <div className="row gap">
          <Button onClick={() => setWeekId(weekIdFromDate(new Date(Date.now() - 7*86400000)))}>← Prev</Button>
          <Button onClick={() => setWeekId(weekIdFromDate())}>This week</Button>
          <Button onClick={() => setWeekId(weekIdFromDate(new Date(Date.now() + 7*86400000)))}>Next →</Button>
          <Link className="btn" href="/fitness/day">Today</Link>
          <Link className="btn ghost" href="/fitness">Back</Link>
        </div>
      </header>

      {busy || !plan ? (
        <div className="glass center"><div className="spinner" /> Loading…</div>
      ) : (
        <section className="grid7">
          {dayKeys.map((k) => {
            const d = plan.days[k];
            const firstName = d.items[0]?.name;
            const ex = firstName ? exCache[firstName] : null;
            return (
              <div key={k} className="col glass">
                <div className="hdr">
                  <div className="d">{dayNames[k]}</div>
                  <div className="date">{d.date}</div>
                </div>

                {/* quick preview GIF */}
                {ex ? (
                  <div className="preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="gif" src={gif(ex.id)} alt={ex.name} loading="lazy"
                        onError={(e)=>((e.currentTarget as HTMLImageElement).style.display="none")} />
                    <div className="ex">{cap(ex.name)}</div>
                  </div>
                ) : <div className="preview placeholder">No preview</div>}

                <ul className="list">
                  {d.items.map((it) => (
                    <li key={it.id} className={`it ${it.done ? "done" : ""}`}>
                      <label className="chk">
                        <input type="checkbox" checked={!!it.done} onChange={(e)=>setDone(k, it.id, e.currentTarget.checked)} />
                        <span>{it.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>

                <Button variant="secondary" onClick={() => addItem(k)} style={{ width: "100%" }}>
                  + Add workout
                </Button>

                <div className="meals">
                  <div className="msT">Meals</div>
                  <div className="mgrid">
                    {mealMap[k]?.length ? mealMap[k].map(m => (
                      <div key={m.id} className="meal" title={m.title}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.image || "/placeholder.png"} alt={m.title} />
                        <div className="mt">{m.title}</div>
                      </div>
                    )) : <div className="muted small">No suggestions</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .shell{max-width:1200px;margin:0 auto;padding:18px}
        .title{margin:0;font-size:28px;font-weight:900}
        .muted{color:#64748b}.btn{border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:8px 12px}
        .btn.ghost{background:transparent}
        .top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:10px}
        .grid7{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
        @media (max-width:1200px){ .grid7{grid-template-columns:repeat(3,1fr)} }
        @media (max-width:720px){ .grid7{grid-template-columns:1fr} }
        .glass{border:1px solid #e5e7eb;background:linear-gradient(180deg,#fff,#f8fafc);border-radius:18px;padding:12px;box-shadow:0 10px 30px rgba(2,6,23,.06)}
        .center{display:grid;place-items:center;min-height:160px}
        .spinner{width:18px;height:18px;border-radius:50%;border:3px solid #e5e7eb;border-top-color:#0f172a;animation:sp 1s linear infinite}
        @keyframes sp{to{transform:rotate(360deg)}}
        .col{display:flex;flex-direction:column;gap:8px}
        .hdr{display:flex;justify-content:space-between;align-items:center}
        .d{font-weight:900}.date{font-size:12px;color:#64748b}
        .preview{border:1px dashed #e5e7eb;border-radius:12px;padding:6px;display:grid;gap:6px;place-items:center;background:#fafafa}
        .preview.placeholder{color:#94a3b8;font-size:12px}
        .gif{width:100%;max-height:140px;object-fit:contain;background:#f8fafc;border-radius:10px}
        .ex{font-size:12px;font-weight:700}
        .list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
        .it{border:1px solid #eef2f7;border-radius:10px;padding:8px;background:#fff}
        .it.done{opacity:.7;text-decoration:line-through}
        .chk{display:flex;gap:8px;align-items:center}
        .meals{margin-top:6px}
        .msT{font-size:12px;color:#64748b;margin-bottom:4px}
        .mgrid{display:grid;grid-template-columns:1fr;gap:6px}
        .meal{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;border:1px solid #eef2f7;border-radius:10px;padding:6px;background:#fff}
        .meal img{width:44px;height:44px;object-fit:cover;border-radius:8px;background:#f3f4f6}
        .mt{font-size:13px;font-weight:600;color:#0f172a}
      `}</style>
    </main>
  );
}
