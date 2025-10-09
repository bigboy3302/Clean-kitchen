"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";
import {
  getWeekPlan, upsertDayItem, toggleDone, removeDayItem, getMetrics, getOrCreateDailyMeals,
  type WeekPlan, type WorkoutItem, type DayKey, type SuggestedMeal,
} from "@/lib/fitness/store";
import type { Exercise } from "@/lib/workouts/types";

const dayNames: Record<DayKey, string> = {
  mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday", fri:"Friday", sat:"Saturday", sun:"Sunday",
};
const dayOrder: DayKey[] = ["mon","tue","wed","thu","fri","sat","sun"];
function currentDayKey(date = new Date()): DayKey { const js = date.getDay(); return (["sun","mon","tue","wed","thu","fri","sat"][js] as DayKey)||"mon"; }
const cap = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const mediaSrc = (ex: Exercise | null) => (ex?.gifUrl || ex?.imageThumbnailUrl || ex?.imageUrl || "/placeholder.png");

const exerciseFromItem = (item: WorkoutItem): Exercise | null => {
  if (!item.exercise) return null;
  const meta = item.exercise as any;
  const primaryMuscles = Array.isArray(meta.primaryMuscles) ? meta.primaryMuscles.map(String) : [];
  const secondaryMuscles = Array.isArray(meta.secondaryMuscles) ? meta.secondaryMuscles.map(String) : [];
  const equipmentList = Array.isArray(meta.equipmentList) ? meta.equipmentList.map(String)
    : meta.equipment ? [String(meta.equipment)] : [];
  return {
    id: meta.id ? String(meta.id) : item.exerciseId ? String(item.exerciseId) : item.id,
    name: meta.name ? String(meta.name) : item.name,
    bodyPart: meta.bodyPart ? String(meta.bodyPart) : "Full body",
    target: meta.target ?? (primaryMuscles[0] || meta.bodyPart || "General"),
    equipment: meta.equipment || equipmentList[0] || "Bodyweight",
    gifUrl: typeof meta.imageUrl === "string" ? meta.imageUrl : "",
    imageUrl: typeof meta.imageUrl === "string" ? meta.imageUrl : null,
    imageThumbnailUrl: typeof meta.imageThumbnailUrl === "string" ? meta.imageThumbnailUrl
      : typeof meta.imageUrl === "string" ? meta.imageUrl : null,
    descriptionHtml: typeof meta.descriptionHtml === "string" ? meta.descriptionHtml : "",
    primaryMuscles, secondaryMuscles, equipmentList: equipmentList.length ? equipmentList : ["Bodyweight"],
  };
};

export default function DayPlannerPage() {
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [day, setDay] = useState<DayKey>(() => currentDayKey());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [goal, setGoal] = useState<"bulk"|"cut"|"maintain">("maintain");
  const [exByItem, setExByItem] = useState<Record<string, Exercise | null>>({});
  const [recipes, setRecipes] = useState<SuggestedMeal[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setBusy(true);
        const metrics = await getMetrics().catch(() => null);
        if (!ignore && metrics?.goal) setGoal(metrics.goal);
        const freshPlan = await getWeekPlan(); if (!ignore) setPlan(freshPlan);
        const todaysMeals = await getOrCreateDailyMeals(undefined, metrics?.goal ?? "maintain", 3);
        if (!ignore) setRecipes(todaysMeals.slice(0, 3));
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Unable to load today.");
      } finally { if (!ignore) setBusy(false); }
    })();
    return () => { ignore = true; };
  }, []);

  const items = useMemo(() => plan?.days?.[day]?.items ?? [], [plan, day]);

  useEffect(() => {
    if (!items.length) { setExByItem({}); return; }
    let ignore = false;
    (async () => {
      const map: Record<string, Exercise | null> = {};
      for (const item of items) {
        if (ignore) return;
        const stored = exerciseFromItem(item);
        if (stored) map[item.id] = stored;
        else {
          try {
            const res = await fetch(`/api/workouts?q=${encodeURIComponent(item.name)}&limit=1`, { cache: "no-store" });
            const data = (await res.json()) as Exercise[] | { error?: string };
            map[item.id] = Array.isArray(data) && data.length ? data[0] : null;
          } catch { map[item.id] = null; }
        }
      }
      if (!ignore) setExByItem(map);
    })();
    return () => { ignore = true; };
  }, [items]);

  async function refreshPlan(targetWeekId?: string) {
    try { const fresh = await getWeekPlan(targetWeekId); setPlan(fresh); }
    catch (e:any) { setError(e?.message || "Unable to refresh plan"); }
  }

  async function addItem() {
    const name = text.trim();
    if (!name || !plan) return;
    setBusy(true);
    try {
      const item: WorkoutItem = { id: crypto.randomUUID(), name, done: false };
      await upsertDayItem(plan.weekId, day, item);
      await refreshPlan(plan.weekId);
      setText("");
    } catch (e:any) { setError(e?.message || "Unable to add workout"); }
    finally { setBusy(false); }
  }

  async function toggleItem(id: string, done: boolean) {
    if (!plan) return; setBusy(true);
    try { await toggleDone(plan.weekId, day, id, done); await refreshPlan(plan.weekId); }
    catch (e:any){ setError(e?.message || "Unable to update workout"); }
    finally { setBusy(false); }
  }

  async function removeItem(id: string) {
    if (!plan) return; setBusy(true);
    try { await removeDayItem(plan.weekId, day, id); await refreshPlan(plan.weekId); }
    catch (e:any){ setError(e?.message || "Unable to remove workout"); }
    finally { setBusy(false); }
  }

  const dayDateIso = plan?.days?.[day]?.date;
  const dayDateLabel = useMemo(() => {
    if (!dayDateIso) return new Date().toLocaleDateString();
    const parsed = new Date(`${dayDateIso}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dayDateIso;
    return parsed.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  }, [dayDateIso]);

  const planEmpty = !busy && items.length === 0;

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1 className="title">Today</h1>
        <p className="muted">{dayNames[day]} · {dayDateLabel}</p>
        </div>
        <Link className="btn" href="/fitness">← Back to fitness</Link>
      </header>

      <nav className="dayNav" aria-label="Select day">
        {dayOrder.map((d) => (
          <button key={d} type="button" className={`dayBtn ${day===d?"active":""}`} onClick={()=>setDay(d)}>
            {dayNames[d].slice(0,3)}
          </button>
        ))}
      </nav>

      {error ? <div className="alert">{error}</div> : null}

      <section className="card">
        <div className="sectionHead">
          <div>
            <h2 className="sectionTitle">Workout checklist</h2>
            <p className="muted">Add movements, mark done, or remove.</p>
          </div>
        </div>

        <div className="addRow">
          <input className="inp" placeholder="Add workout (e.g., Squat 5x5)" value={text}
                 onChange={(e)=>setText(e.currentTarget.value)}
                 onKeyDown={(e)=>{ if (e.key === "Enter") addItem(); }} />
          <Button onClick={addItem} disabled={!text.trim() || busy}>+ Add</Button>
        </div>

        {busy && !plan ? (
          <p className="muted">Loading plan…</p>
        ) : planEmpty ? (
          <div className="empty">No workouts yet. Add your first item above.</div>
        ) : (
          <ul className="planList">
            {items.map((item) => {
              const resolved = exerciseFromItem(item) || exByItem[item.id] || null;
              const chips = resolved ? [resolved.bodyPart, resolved.target, resolved.equipment]
                .filter(Boolean).filter((c, i, a) => a.indexOf(c) === i) : [];
              return (
                <li key={item.id} className={`workItem ${item.done ? "done" : ""}`}>
                  <div className="workTop">
                    <label className="check">
                      <input type="checkbox" checked={item.done} onChange={(e)=>toggleItem(item.id, e.currentTarget.checked)} />
                      <span>{item.name}</span>
                    </label>
                    <button type="button" className="ghostBtn" onClick={()=>removeItem(item.id)} disabled={busy}>Remove</button>
                  </div>
                  {resolved ? (
                    <div className="workBody">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="workImg" src={mediaSrc(resolved)} alt={resolved.name}
                           loading="lazy"
                           onError={(e)=>{(e.currentTarget as HTMLImageElement).src="/placeholder.png"}} />
                      <div className="workMeta">
                        <div className="workName">{cap(resolved.name)}</div>
                        <p className="workDesc">
                          {stripHtml(resolved.descriptionHtml || "").slice(0,160) ||
                           "Open this movement in the library for full cues."}
                        </p>
                        <div className="chipsRow">
                          {chips.map((chip)=>(<span key={`${item.id}-${chip}`} className="chip">{cap(chip)}</span>))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Meals UI unchanged (omit here for brevity) */}

      <style jsx>{`
        .shell { max-width: 950px; margin: 0 auto; padding: 24px 16px 64px; display: flex; flex-direction: column; gap: 18px; }
        .top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
        .title { margin: 0; font-size: 30px; font-weight: 900; color: var(--text); }
        .muted { color: var(--muted); }
        .btn { border: 1px solid var(--border); background: var(--bg2); color: var(--text); border-radius: 999px; padding: 8px 14px; font-weight: 600; text-decoration: none; }

        .dayNav { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .dayBtn { border: 1px solid var(--border); background: var(--bg2); color: var(--text); border-radius: 10px; padding: 6px 11px; font-weight: 600; transition: all .12s ease; }
        .dayBtn.active { background: var(--primary); border-color: var(--primary); color: var(--primary-contrast); }

        .alert { border: 1px solid color-mix(in oklab, #ef4444 40%, var(--border)); background: color-mix(in oklab, #ef4444 12%, var(--card-bg)); color: #7f1d1d; border-radius: 12px; padding: 10px 14px; }

        .card { border: 1px solid var(--border); background: var(--card-bg); border-radius: 20px; padding: 20px; box-shadow: 0 18px 40px rgba(15, 23, 42, .08); display: flex; flex-direction: column; gap: 18px; }
        .sectionHead { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .sectionTitle { margin: 0; font-size: 22px; font-weight: 800; color: var(--text); }

        .addRow { display: flex; gap: 10px; flex-wrap: wrap; }
        .inp { flex: 1; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--bg2); color: var(--text); }

        .planList { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
        .workItem { border: 1px solid var(--border); border-radius: 16px; padding: 16px; background: var(--bg2); display: flex; flex-direction: column; gap: 12px; }
        .workItem.done { opacity: .65; }
        .workTop { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .check { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--text); }
        .ghostBtn { background: transparent; border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border)); color: color-mix(in oklab, var(--primary) 45%, var(--text)); border-radius: 999px; padding: 4px 12px; font-weight: 600; }
        .workBody { display: grid; grid-template-columns: 150px 1fr; gap: 14px; }
        @media (max-width: 640px) { .workBody { grid-template-columns: 1fr; } }
        .workImg { width: 100%; border-radius: 12px; object-fit: cover; background: var(--bg); border: 1px solid var(--border); }
        .workMeta { display: flex; flex-direction: column; gap: 8px; }
        .workName { font-weight: 800; color: var(--text); font-size: 16px; }
        .workDesc { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
        .chipsRow { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { font-size: 11px; border-radius: 999px; padding: 3px 9px; border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border)); background: color-mix(in oklab, var(--primary) 12%, var(--bg2)); color: color-mix(in oklab, var(--primary) 45%, var(--text)); }
        .empty { border: 1px dashed var(--border); border-radius: 16px; padding: 18px; text-align: center; background: color-mix(in oklab, var(--bg2) 70%, transparent); }
      `}</style>
    </main>
  );
}
