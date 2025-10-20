"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const dayNames: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export default function WeeklyPlannerPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [week, setWeek] = useState(isoWeekKey());
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newWorkout, setNewWorkout] = useState<Record<string, string>>({});
  const [newMeal, setNewMeal] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSave = useMemo(() => !!uid && !!plan, [uid, plan]);

  useEffect(() => {
    let alive = true;
    const loadWeek = async () => {
      try {
        const gotUid = await requireSignedIn();
        if (!alive) return;
        setUid(gotUid);

        const currentWeek = isoWeekKey();
        setWeek(currentWeek);

        const data = await loadOrCreateWeek(gotUid, currentWeek);
        if (!alive) return;
        setPlan(data);
      } catch (error) {
        setErr(getErrorMessage(error, "Please sign in to view your weekly planner."));
      } finally {
        if (alive) setBusy(false);
      }
    };

    loadWeek();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    []
  );

  async function addWorkout(day: DayKey) {
    if (!uid || !plan) return;
    const text = (newWorkout[day] || "").trim();
    if (!text) return;

    const currentDay = plan.days[day];
    const nextDay: DayPlan = { ...currentDay, workouts: [...currentDay.workouts, text] };
    const nextPlan: WeekPlan = { ...plan, days: { ...plan.days, [day]: nextDay } };

    setPlan(nextPlan);
    setNewWorkout((state) => ({ ...state, [day]: "" }));

    try {
      await saveDay(uid, week, day, nextDay);
      notify("Workout added");
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to save workout."));
    }
  }

  async function addMeal(day: DayKey) {
    if (!uid || !plan) return;
    const text = (newMeal[day] || "").trim();
    if (!text) return;

    const currentDay = plan.days[day];
    const nextDay: DayPlan = { ...currentDay, meals: [...currentDay.meals, text] };
    const nextPlan: WeekPlan = { ...plan, days: { ...plan.days, [day]: nextDay } };

    setPlan(nextPlan);
    setNewMeal((state) => ({ ...state, [day]: "" }));

    try {
      await saveDay(uid, week, day, nextDay);
      notify("Meal added");
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to save meal."));
    }
  }

  async function removeItem(day: DayKey, type: "workouts" | "meals", index: number) {
    if (!uid || !plan) return;

    const currentDay = plan.days[day];
    const nextDay: DayPlan = {
      ...currentDay,
      [type]: currentDay[type].filter((_, i) => i !== index),
    };
    const nextPlan: WeekPlan = { ...plan, days: { ...plan.days, [day]: nextDay } };

    setPlan(nextPlan);
    try {
      await saveDay(uid, week, day, nextDay);
      notify("Removed");
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to update day."));
    }
  }

  async function saveAll() {
    if (!plan) return;
    try {
      await saveWeek(plan);
      notify("Saved");
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to save week."));
    }
  }

  function notify(message: string) {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 1600);
  }

  if (busy) {
    return (
      <div className="screen">
        <div className="loader">Loading your week...</div>
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
      {toast ? <div className="toast">{toast}</div> : null}

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
        {dayNames.map((day) => (
          <section key={day.key} className="col">
            <h3 className="h3">{day.label}</h3>

            <div className="block">
              <div className="k">Workouts</div>
              <ul className="list">
                {plan.days[day.key].workouts.map((workout, index) => (
                  <li key={index} className="row">
                    <span className="text">{workout}</span>
                    <button
                      className="x"
                      onClick={() => removeItem(day.key, "workouts", index)}
                      aria-label="Remove workout"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              <div className="add">
                <input
                  className="inp"
                  placeholder="Add workout... (e.g., Squat 5x5)"
                  value={newWorkout[day.key] || ""}
                  onChange={(event) =>
                    setNewWorkout((state) => ({ ...state, [day.key]: event.currentTarget.value }))
                  }
                />
                <button className="btn sm" onClick={() => addWorkout(day.key)}>
                  Add
                </button>
              </div>
            </div>

            <div className="block">
              <div className="k">Meals</div>
              <ul className="list">
                {plan.days[day.key].meals.map((meal, index) => (
                  <li key={index} className="row">
                    <span className="text">{meal}</span>
                    <button
                      className="x"
                      onClick={() => removeItem(day.key, "meals", index)}
                      aria-label="Remove meal"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              <div className="add">
                <input
                  className="inp"
                  placeholder="Add meal... (paste recipe title/link)"
                  value={newMeal[day.key] || ""}
                  onChange={(event) =>
                    setNewMeal((state) => ({ ...state, [day.key]: event.currentTarget.value }))
                  }
                />
                <button className="btn sm" onClick={() => addMeal(day.key)}>
                  Add +
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .title {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .muted {
          color: #64748b;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          cursor: pointer;
        }
        .btn.sm {
          padding: 6px 10px;
          font-size: 13px;
        }
        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }
        .grid7 {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 12px;
        }
        @media (max-width: 1100px) {
          .grid7 {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 700px) {
          .grid7 {
            grid-template-columns: 1fr;
          }
        }
        .col {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 14px;
          padding: 12px;
        }
        .h3 {
          margin: 0 0 8px;
          font-weight: 800;
        }
        .block {
          margin-top: 8px;
        }
        .k {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;
        }
        .list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #eef2f7;
          border-radius: 10px;
          padding: 6px 8px;
        }
        .text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 80%;
        }
        .x {
          border: none;
          background: #ef4444;
          color: #fff;
          border-radius: 8px;
          padding: 2px 8px;
          cursor: pointer;
        }
        .add {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
        .inp {
          flex: 1;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 8px 10px;
        }
        .error {
          color: #b91c1c;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 10px;
        }
        .screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: #0b1220;
          color: #e9eef8;
        }
        .loader {
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }
        .toast {
          position: fixed;
          right: 14px;
          bottom: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #0f172a;
          color: #fff;
          box-shadow: 0 10px 30px rgba(2, 6, 23, 0.25);
          z-index: 50;
        }
      `}</style>
    </main>
  );
}
