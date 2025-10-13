// app/fitness/weekly/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { requireSignedIn } from "@/lib/fitness/store";
import {
  isoWeekKey,
  loadOrCreateWeek,
  saveDay,
  saveWeek,
  type DayKey,
  type DayPlan,
  type WeekPlan,
} from "@/lib/planner";

const dayNames: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export default function WeeklyPlannerPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [week, setWeek] = useState(isoWeekKey());
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newWorkout, setNewWorkout] = useState<Record<string, string>>({});
  const [newMeal, setNewMeal] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // ✅ requireSignedIn returns a string UID (not { uid })
        const gotUid = await requireSignedIn();
        if (!alive) return;
        setUid(gotUid);

        const wk = isoWeekKey();
        setWeek(wk);

        const data = await loadOrCreateWeek(gotUid, wk);
        if (!alive) return;
        setPlan(data);
      } catch (e: any) {
        setErr(e?.message || "Please sign in to view your weekly planner.");
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const canSave = useMemo(() => !!uid && !!plan, [uid, plan]);

  async function addWorkout(day: DayKey) {
    if (!canSave) return;
    const text = (newWorkout[day] || "").trim();
    if (!text) return;
    const cur = plan!.days[day];
    const nextDay: DayPlan = { ...cur, workouts: [...cur.workouts, text] };
    const nextPlan = { ...plan!, days: { ...plan!.days, [day]: nextDay } };
    setPlan(nextPlan);
    setNewWorkout((s) => ({ ...s, [day]: "" }));
    try {
      await saveDay(uid!, week, day, nextDay);
      notify("Workout added");
    } catch (e: any) {
      setErr(e?.message || "Failed to save workout.");
    }
  }

  async function addMeal(day: DayKey) {
    if (!canSave) return;
    const text = (newMeal[day] || "").trim();
    if (!text) return;
    const cur = plan!.days[day];
    const nextDay: DayPlan = { ...cur, meals: [...cur.meals, text] };
    const nextPlan = { ...plan!, days: { ...plan!.days, [day]: nextDay } };
    setPlan(nextPlan);
    setNewMeal((s) => ({ ...s, [day]: "" }));
    try {
      await saveDay(uid!, week, day, nextDay);
      notify("Meal added");
    } catch (e: any) {
      setErr(e?.message || "Failed to save meal.");
    }
  }

  async function removeItem(day: DayKey, type: "workouts" | "meals", idx: number) {
    if (!canSave) return;
    const cur = plan!.days[day];
    const nextDay: DayPlan = { ...cur, [type]: cur[type].filter((_, i) => i !== idx) };
    const nextPlan = { ...plan!, days: { ...plan!.days, [day]: nextDay } };
    setPlan(nextPlan);
    try {
      await saveDay(uid!, week, day, nextDay);
      notify("Removed");
    } catch (e: any) {
      setErr(e?.message || "Failed to update day.");
    }
  }

  async function saveAll() {
    if (!canSave) return;
    try {
      await saveWeek(plan!);
      notify("Saved");
    } catch (e: any) {
      setErr(e?.message || "Failed to save week.");
    }
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  if (busy) {
    return (
      <div className="screen">
        <div className="loader">Loading your week…</div>
      </div>
    );
  }

  if (err) {
    return (
      <main className="wrap">
        <p className="error">{err}</p>
      </main>
    );
  }

  if (!plan) return null;

  return (
    <main className="wrap">
      {toast && <div className="toast">{toast}</div>}

      <div className="head">
        <div>
          <h1 className="title">Weekly planner</h1>
          <div className="muted">{plan.week}</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={saveAll} disabled={!canSave}>
            Save all
          </button>
        </div>
      </div>

      <div className="grid7">
        {dayNames.map((d) => (
          <section key={d.key} className="col">
            <h3 className="h3">{d.label}</h3>

            <div className="block">
              <div className="k">Workouts</div>
              <ul className="list">
                {plan.days[d.key].workouts.map((w, i) => (
                  <li key={i} className="row">
                    <span className="text">{w}</span>
                    <button className="x" onClick={() => removeItem(d.key, "workouts", i)} aria-label="Remove">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="add">
                <input
                  className="inp"
                  placeholder="Add workout… (e.g., Squat 5x5)"
                  value={newWorkout[d.key] || ""}
                  onChange={(e) => setNewWorkout((s) => ({ ...s, [d.key]: e.currentTarget.value }))}
                />
                <button className="btn sm" onClick={() => addWorkout(d.key)}>
                  Add
                </button>
              </div>
            </div>

            <div className="block">
              <div className="k">Meals</div>
              <ul className="list">
                {plan.days[d.key].meals.map((m, i) => (
                  <li key={i} className="row">
                    <span className="text">{m}</span>
                    <button className="x" onClick={() => removeItem(d.key, "meals", i)} aria-label="Remove">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="add">
                <input
                  className="inp"
                  placeholder="Add meal… (paste recipe title/link)"
                  value={newMeal[d.key] || ""}
                  onChange={(e) => setNewMeal((s) => ({ ...s, [d.key]: e.currentTarget.value }))}
                />
                <button className="btn sm" onClick={() => addMeal(d.key)}>
                  Add
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <style jsx>{`
        .wrap{max-width:1100px;margin:0 auto;padding:16px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .title{margin:0;font-size:24px;font-weight:800;letter-spacing:-.01em}
        .muted{color:#64748b}
        .actions{display:flex;gap:8px}
        .btn{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
        .btn.sm{padding:6px 10px;font-size:13px}

        .grid7{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
        @media (max-width:1100px){ .grid7{grid-template-columns:repeat(3,1fr)} }
        @media (max-width:700px){ .grid7{grid-template-columns:1fr} }
        .col{border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px}
        .h3{margin:0 0 8px;font-weight:800}

        .block{margin-top:8px}
        .k{font-size:12px;color:#64748b;margin-bottom:6px}
        .list{margin:0;padding:0;list-style:none;display:grid;gap:6px}
        .row{display:flex;justify-content:space-between;align-items:center;border:1px solid #eef2f7;border-radius:10px;padding:6px 8px}
        .text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%}
        .x{border:none;background:#ef4444;color:#fff;border-radius:8px;padding:2px 8px;cursor:pointer}

        .add{display:flex;gap:6px;margin-top:8px}
        .inp{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px}

        .error{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px}

        .screen{position:fixed;inset:0;display:grid;place-items:center;background:#0b1220;color:#e9eef8}
        .loader{padding:12px 16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}

        .toast{
          position:fixed;right:14px;bottom:14px;padding:10px 12px;border-radius:10px;
          background:#0f172a;color:#fff;box-shadow:0 10px 30px rgba(2,6,23,.25);z-index:50
        }
      `}</style>
    </main>
  );
}
