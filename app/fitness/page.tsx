"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Meter from "@/components/ui/Meter";
import { Goal, Activity, mifflinStJeor, tdee, targetCalories, macroTargets, goalSuitability } from "@/lib/fitness/calc";
import { getMetrics, saveMetrics, Metrics } from "@/lib/fitness/store";
import WorkoutGrid from "@/components/fitness/WorkoutGrid";

type Form = {
  sex: "male"|"female";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
};

export default function FitnessPage() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Form>({
    sex: "male", age: 24, heightCm: 178, weightKg: 75, activity: "moderate", goal: "maintain",
  });

  useEffect(() => {
    (async () => {
      try {
        const m = await getMetrics();
        if (m) {
          setF({
            sex: (m.sex ?? "male") as Form["sex"],
            age: Number(m.age ?? 24),
            heightCm: Number(m.heightCm ?? 178),
            weightKg: Number(m.weightKg ?? 75),
            activity: (m.activity ?? "moderate") as Activity,
            goal: (m.goal ?? "maintain") as Goal,
          });
        } else {
          setEditing(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bmr = useMemo(() => mifflinStJeor(f.sex, f.age, f.heightCm, f.weightKg), [f]);
  const tdeeVal = useMemo(() => tdee(bmr, f.activity), [bmr, f.activity]);
  const calTarget = useMemo(() => targetCalories(tdeeVal, f.goal), [tdeeVal, f.goal]);
  const macros = useMemo(() => macroTargets(f.weightKg, f.goal, calTarget), [f, calTarget]);
  const suit = useMemo(() => goalSuitability(f.age, f.goal), [f.age, f.goal]);

  function update<K extends keyof Form>(k: K, v: Form[K]) { setF(prev => ({ ...prev, [k]: v })); }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: Metrics = {
      sex: f.sex, age: f.age, heightCm: f.heightCm, weightKg: f.weightKg, activity: f.activity, goal: f.goal,
    };
    await saveMetrics(payload);
    setEditing(false);
  }

  if (loading) return <main className="shell"><p className="muted">Loading…</p></main>;

  return (
    <main className="shell">
      <div className="top">
        <div>
          <h1 className="title">Fitness</h1>
          <p className="muted">Your personal calories, macros, meals, and weekly workout plan.</p>
        </div>
        <div className="row gap">
          <Button onClick={() => setEditing(v => !v)}>{editing ? "Close" : "Edit my data"}</Button>
        </div>
      </div>

      {editing ? (
        <section className="card">
          <h3 className="h3">Your metrics</h3>
          <form className="grid form" onSubmit={onSave}>
            <div>
              <label className="lab">Sex</label>
              <div className="chips">
                {(["male","female"] as const).map(s => (
                  <button key={s} type="button" className={`chip ${f.sex===s?"on":""}`} onClick={()=>update("sex", s)}>{s}</button>
                ))}
              </div>
            </div>
            <div><label className="lab">Age</label><input className="inp" type="number" value={f.age} onChange={e=>update("age", Math.max(5, Number(e.target.value||0)))} /></div>
            <div><label className="lab">Height (cm)</label><input className="inp" type="number" value={f.heightCm} onChange={e=>update("heightCm", Math.max(80, Number(e.target.value||0)))} /></div>
            <div><label className="lab">Weight (kg)</label><input className="inp" type="number" value={f.weightKg} onChange={e=>update("weightKg", Math.max(20, Number(e.target.value||0)))} /></div>

            <div>
              <label className="lab">Activity</label>
              <select className="inp" value={f.activity} onChange={e=>update("activity", e.target.value as any)}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Light (1–3x/week)</option>
                <option value="moderate">Moderate (3–5x/week)</option>
                <option value="active">Active (6–7x/week)</option>
                <option value="veryActive">Very active</option>
              </select>
            </div>

            <div>
              <label className="lab">Goal</label>
              <div className="chips">
                {(["cut","maintain","bulk"] as const).map(g => (
                  <button key={g} type="button" className={`chip ${f.goal===g?"on":""}`} onClick={()=>update("goal", g)}>{g}</button>
                ))}
              </div>
            </div>

            <div className="actions"><Button type="submit">Save</Button></div>
          </form>
        </section>
      ) : null}

      <section className="grid2">
        <Meter status={suit.status} label="Goal suitability" message={suit.message} />
        <div className="card stat">
          <div className="row3">
            <div><div className="k">BMR</div><div className="v">{bmr} kcal</div></div>
            <div><div className="k">TDEE</div><div className="v">{tdeeVal} kcal</div></div>
            <div><div className="k">Target</div><div className="v">{macros.calories} kcal</div></div>
          </div>
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <h3 className="h3">Daily macros</h3>
          <table className="tbl">
            <thead><tr><th>Calories</th><th>Protein</th><th>Fat</th><th>Carbs</th></tr></thead>
            <tbody><tr>
              <td>{macros.calories}</td><td>{macros.proteinG} g</td><td>{macros.fatG} g</td><td>{macros.carbsG} g</td>
            </tr></tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="h3">Weekly plan</h3>
          <p className="muted">Plan your week and check off workouts.</p>
          <Link className="btn" href="/fitness/plan">Open weekly planner →</Link>
          <br/>
          <Link className="btn" href="/fitness/day">Today’s planner</Link>
        </div>
      </section>

      <WorkoutGrid
        initialBodyPart={f.goal === "bulk" ? "upper legs" : f.goal === "cut" ? "cardio" : "back"}
        title="Movement library (GIF)"
        goal={f.goal}
      />

      <style jsx>{`
        .shell{max-width:1020px;margin:0 auto;padding:18px}
        .top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
        .title{margin:0;font-size:28px;font-weight:900}
        .muted{color:#64748b}
        .btn{border:1px solidrgb(82, 88, 99);background:#fff;border-radius:10px;padding:8px 12px;display:inline-block}
        .card{border:1px solidrgb(82, 88, 99);background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.04)}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}
        @media (max-width:900px){ .grid2{grid-template-columns:1fr} }
        .row3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .k{font-size:12px;color:#64748b}.v{font-weight:800}
        .form{grid-template-columns:repeat(4,1fr);gap:12px}
        @media (max-width:900px){ .form{grid-template-columns:repeat(2,1fr)} }
        .lab{font-size:.9rem;color:#111827;font-weight:600;margin-bottom:4px}
        .inp{border:1px solidrgb(82, 88, 99) #d1d5db;border-radius:12px;padding:10px 12px;width:100%}
        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{border:1px solidrgb(82, 88, 99);background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}
        .chip.on{background:#0f172a;color:#fff;border-color:#0f172a}
        .actions{grid-column:1/-1;display:flex;justify-content:flex-end}
        .tbl{width:100%;border-collapse:collapse}
        .tbl th,.tbl td{border:1px solid #e5e7eb;padding:8px;text-align:center}
        .row.gap{display:flex;gap:8px;flex-wrap:wrap}
      `}</style>
    </main>
  );
}
