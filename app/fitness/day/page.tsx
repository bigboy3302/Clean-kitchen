"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";
import {
  getWeekPlan,
  upsertDayItem,
  toggleDone,
  getMetrics,
  weekIdFromDate,
  type WeekPlan,
  type WorkoutItem,
  type DayKey,
  suggestMeals,
  type SuggestedMeal,
} from "@/lib/fitness/store";

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
};

const dayNames: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function currentDayKey(d = new Date()): DayKey {
  const js = d.getDay(); // 0=Sun … 6=Sat
  return (["sun","mon","tue","wed","thu","fri","sat"][js] as DayKey) || "mon";
}
const cap = (s: string) => (s ? s[0].toUpperCase()+s.slice(1) : s);
const gif = (id: string, res = 360) => `/api/workouts/gif?id=${encodeURIComponent(id)}&res=${res}`;

export default function DayPlannerPage() {
  const [weekId, setWeekId] = useState(weekIdFromDate());
  const [day, setDay] = useState<DayKey>(currentDayKey());
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [goal, setGoal] = useState<"bulk" | "cut" | "maintain">("maintain");

  const [addText, setAddText] = useState("");
  const [exByItem, setExByItem] = useState<Record<string, Exercise[]>>({});
  const [meals, setMeals] = useState<SuggestedMeal[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        const m = await getMetrics().catch(()=>null);
        if (m?.goal) setGoal(m.goal);
        setWeekId(weekIdFromDate());
        const w = await getWeekPlan(weekIdFromDate());
        setPlan(w);

        // meals for today (4 suggestions)
        const recs = await suggestMeals(m?.goal ?? "maintain", 6);
        setMeals(recs.slice(0,4));
      } catch (e: any) {
        setErr(e?.message || "Failed to load your day.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const items = useMemo(() => plan?.days?.[day]?.items ?? [], [plan, day]);

  useEffect(() => {
    // when items change, (re)fetch the first best exercise for each item
    if (!items.length) return;
    let stop = false;
    (async () => {
      const map: Record<string, Exercise[]> = {};
      for (const it of items) {
        try {
          const res = await fetch(`/api/workouts?q=${encodeURIComponent(it.name)}&limit=1`, { cache: "no-store" });
          const data = (await res.json()) as Exercise[] | { error?: string };
          map[it.id] = Array.isArray(data) ? data : [];
          if (stop) return;
        } catch {
          map[it.id] = [];
        }
      }
      if (!stop) setExByItem(map);
    })();
    return () => { stop = true; };
  }, [items.map(i=>i.name).join("|")]); // refetch if names change

  async function addItem() {
    const name = addText.trim();
    if (!name || !plan) return;
    setBusy(true);
    try {
      const item: WorkoutItem = { id: crypto.randomUUID(), name, done: false };
      await upsertDayItem(plan.weekId, day, item);
      const next = await getWeekPlan(plan.weekId);
      setPlan(next);
      setAddText("");
    } finally {
      setBusy(false);
    }
  }

  async function setDone(id: string, done: boolean) {
    if (!plan) return;
    setBusy(true);
    try {
      await toggleDone(plan.weekId, day, id, done);
      const next = await getWeekPlan(plan.weekId);
      setPlan(next);
    } finally {
      setBusy(false);
    }
  }

  const photoBadge =
    goal === "bulk" ? "badge bulk" : goal === "cut" ? "badge cut" : "badge maintain";

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">Today</h1>
          <p className="muted">{dayNames[day]} • {new Date().toLocaleDateString()}</p>
        </div>
        <div className="row gap">
          <Link className="btn ghost" href="/fitness">Back</Link>
          <Link className="btn" href="/fitness/plan">Weekly plan →</Link>
        </div>
      </header>

      <section className="hero">
        <div className="heroCol">
          <div className="heroCard">
            <div className="pill">{dayNames[day]}</div>
            <h3 className="h3">Workout checklist</h3>
            {/* add line */}
            <div className="addRow">
              <input
                className="inp"
                placeholder="Add workout (e.g., Squat 5x5, Push day, HIIT 20m)"
                value={addText}
                onChange={(e)=>setAddText(e.currentTarget.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter") addItem(); }}
              />
              <Button onClick={addItem} disabled={!addText.trim() || busy}>+ Add</Button>
            </div>

            {/* items */}
            {busy && !plan ? (
              <div className="muted">Loading…</div>
            ) : err ? (
              <div className="error">{err}</div>
            ) : items.length === 0 ? (
              <div className="empty">No workouts yet. Add one above.</div>
            ) : (
              <ul className="list">
                {items.map((it) => {
                  const ex = exByItem[it.id]?.[0]; // first match
                  return (
                    <li key={it.id} className={`card it ${it.done ? "done" : ""}`}>
                      <label className="chk">
                        <input type="checkbox" checked={!!it.done} onChange={(e)=>setDone(it.id, e.currentTarget.checked)} />
                        <span className="name">{it.name}</span>
                      </label>
                      {ex ? (
                        <div className="how">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="gif" src={gif(ex.id)} alt={ex.name} loading="lazy"
                               onError={(e)=>((e.currentTarget as HTMLImageElement).style.display="none")} />
                          <div className="meta">
                            <div className="ex">{cap(ex.name)}</div>
                            <div className="tags">
                              <span className="chip sm">{cap(ex.bodyPart)}</span>
                              <span className="chip sm">{cap(ex.target)}</span>
                              <span className="chip sm">{cap(ex.equipment)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="muted small">No GIF found for this item name.</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="heroCol">
          <div className="heroCard">
            <div className={photoBadge}>{goal.toUpperCase()}</div>
            <h3 className="h3">Suggested meals for today</h3>
            <div className="mealGrid">
              {meals.map((m) => (
                <div key={m.id} className="meal">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image || "/placeholder.png"} alt={m.title} />
                  <div className="mt">{m.title}</div>
                </div>
              ))}
            </div>
            <p className="muted small">Meals pulled from your `/api/recipes` based on goal.</p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .shell{max-width:1100px;margin:0 auto;padding:18px}
        .topbar{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
        .title{margin:0;font-size:28px;font-weight:900}
        .muted{color:#64748b}.small{font-size:12px}
        .row.gap{display:flex;gap:8px;flex-wrap:wrap}
        .btn{border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:8px 12px}
        .btn.ghost{background:transparent}

        .hero{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
        @media (max-width:980px){.hero{grid-template-columns:1fr}}
        .heroCol{display:flex}
        .heroCard{border:1px solid #e5e7eb;background:linear-gradient(180deg,#fff,#f8fafc);border-radius:18px;padding:16px;box-shadow:0 10px 30px rgba(2,6,23,.06);width:100%}
        .pill{font-size:12px;background:#0f172a;color:#fff;border-radius:999px;padding:4px 10px;font-weight:800;display:inline-block;margin-bottom:6px}
        .h3{margin:0 0 8px}
        .badge{border:1px solid #e5e7eb;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800;display:inline-block;margin-bottom:6px}
        .badge.bulk{background:#eef2ff;color:#3730a3;border-color:#c7d2fe}
        .badge.cut{background:#fee2e2;color:#7f1d1d;border-color:#fecaca}
        .badge.maintain{background:#dcfce7;color:#065f46;border-color:#bbf7d0}

        .addRow{display:flex;gap:8px;align-items:center;margin:8px 0 10px}
        .inp{flex:1;border:1px solid #d1d5db;border-radius:12px;padding:10px 12px}
        .card{border:1px solid #eef2f7;background:#fff;border-radius:14px;padding:10px}
        .list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
        .it.done{opacity:.75}
        .chk{display:flex;align-items:center;gap:10px}
        .name{font-weight:800;color:#0f172a}

        .how{display:grid;grid-template-columns:160px 1fr;gap:10px;margin-top:8px}
        @media (max-width:600px){ .how{grid-template-columns:1fr} }
        .gif{width:100%;height:160px;object-fit:contain;background:#f8fafc;border-radius:10px;border:1px solid #eef2f7}
        .meta{display:flex;flex-direction:column;gap:6px}
        .ex{font-weight:800}
        .tags{display:flex;gap:6px;flex-wrap:wrap}
        .chip.sm{font-size:11px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:2px 8px}

        .mealGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        @media (max-width:600px){ .mealGrid{grid-template-columns:1fr} }
        .meal{border:1px solid #eef2f7;border-radius:12px;padding:8px;background:#fff;display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center}
        .meal img{width:64px;height:64px;border-radius:10px;object-fit:cover;background:#f1f5f9}
        .mt{font-weight:700}
        .empty{border:1px dashed #e2e8f0;border-radius:12px;padding:16px;text-align:center;background:#fafafa}
        .error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}
      `}</style>
    </main>
  );
}
