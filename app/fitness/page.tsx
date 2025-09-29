
"use client";
import WorkoutGrid from "@/components/fitness/WorkoutGrid";
import { useMemo, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Meter from "@/components/ui/Meter";
import {
  Activity,
  Goal,
  Sex,
  goalSuitability,
  macroTargets,
  mifflinStJeor,
  tdee,
  weekly,
} from "@/lib/fitness/calc";

type FormState = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
};

const defaultForm: FormState = {
  sex: "male",
  age: 24,
  heightCm: 178,
  weightKg: 75,
  activity: "moderate",
  goal: "maintain",
};

export default function FitnessPage() {
  const [f, setF] = useState<FormState>(defaultForm);
  const [show, setShow] = useState(false);

  const bmr = useMemo(() => mifflinStJeor(f.sex, f.age, f.heightCm, f.weightKg), [f]);
  const tdeeVal = useMemo(() => tdee(bmr, f.activity), [bmr, f.activity]);
  const daily = useMemo(
    () => macroTargets(f.weightKg, f.goal, targetCalories(tdeeVal, f.goal)),
    [f, tdeeVal]
  );
  const weeklyTotals = useMemo(
    () =>
      weekly({
        calories: daily.calories,
        proteinG: daily.proteinG,
        fatG: daily.fatG,
        carbsG: daily.carbsG,
      }),
    [daily]
  );
  const suit = useMemo(() => goalSuitability(f.age, f.goal), [f.age, f.goal]);

  function targetCalories(tdeeValue: number, goal: Goal) {
    const adj = goal === "bulk" ? 1.15 : goal === "cut" ? 0.8 : 1.0;
    return Math.round(tdeeValue * adj);
  }

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShow(true);
  }

  return (
    <main className="container">
      <h1 className="title">Fitness planner</h1>
      <p className="muted">
        This tool estimates calories & macros and suggests foods, products, and workouts for your goal. It’s general guidance—not medical advice.
      </p>

      <section className="card">
        <form className="grid" onSubmit={onSubmit}>
          <div className="row">
            <div className="field">
              <label className="lab">Sex</label>
              <div className="chips">
                {(["male", "female"] as Sex[]).map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`chip ${f.sex === s ? "on" : ""}`}
                    onClick={() => update("sex", s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Age"
              type="number"
              value={String(f.age)}
              onChange={(e: any) => update("age", Math.max(5, Number(e.target.value || 0)))}
            />
            <Input
              label="Height (cm)"
              type="number"
              value={String(f.heightCm)}
              onChange={(e: any) => update("heightCm", Math.max(80, Number(e.target.value || 0)))}
            />
            <Input
              label="Weight (kg)"
              type="number"
              value={String(f.weightKg)}
              onChange={(e: any) => update("weightKg", Math.max(20, Number(e.target.value || 0)))}
            />
          </div>

          <div className="row">
            <div className="field">
              <label className="lab">Activity</label>
              <select
                className="select"
                value={f.activity}
                onChange={(e) => update("activity", e.target.value as Activity)}
              >
                <option value="sedentary">Sedentary (little/no exercise)</option>
                <option value="light">Light (1–3x/week)</option>
                <option value="moderate">Moderate (3–5x/week)</option>
                <option value="active">Active (6–7x/week)</option>
                <option value="veryActive">Very active (2x/day training)</option>
              </select>
            </div>

            <div className="field">
              <label className="lab">Goal</label>
              <div className="chips">
                {(["cut", "maintain", "bulk"] as Goal[]).map((g) => (
                  <button
                    type="button"
                    key={g}
                    className={`chip ${f.goal === g ? "on" : ""}`}
                    onClick={() => update("goal", g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="spacer" />
            <div className="spacer" />
          </div>

          <div className="actions">
            <Button type="submit">Calculate</Button>
          </div>
        </form>
      </section>

      {show && (
        <>
          <section className="grid2">
            <Meter
              status={suit.status}
              label="Goal suitability for your age"
              message={suit.message}
            />

            <div className="card stat">
              <div className="row2">
                <div>
                  <div className="k">BMR</div>
                  <div className="v">{bmr} kcal/day</div>
                </div>
                <div>
                  <div className="k">TDEE</div>
                  <div className="v">{tdeeVal} kcal/day</div>
                </div>
                <div>
                  <div className="k">Target calories</div>
                  <div className="v">{daily.calories} kcal/day</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid2">
            <div className="card">
              <h3 className="h3">Daily macros</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Calories</th>
                    <th>Protein</th>
                    <th>Fat</th>
                    <th>Carbs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{daily.calories}</td>
                    <td>{daily.proteinG} g</td>
                    <td>{daily.fatG} g</td>
                    <td>{daily.carbsG} g</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 className="h3">Weekly totals</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Calories</th>
                    <th>Protein</th>
                    <th>Fat</th>
                    <th>Carbs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{weeklyTotals.calories}</td>
                    <td>{weeklyTotals.proteinG} g</td>
                    <td>{weeklyTotals.fatG} g</td>
                    <td>{weeklyTotals.carbsG} g</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <Recommendations goal={f.goal} />

          {/* 🎥 Exercise GIF browser */}
          <WorkoutGrid
  initialBodyPart={f.goal === "bulk" ? "upper legs" : f.goal === "cut" ? "cardio" : "back"}
  title="How to do the movements (GIFs)"
  goal={f.goal}
/>

        </>
      )}

      <style jsx>{`
        .container{max-width:980px;margin:0 auto;padding:20px}
        .title{margin:0 0 6px;font-size:28px;font-weight:800}
        .muted{color:#64748b;margin:0 0 16px}
        .card{border:1px solid #e5e7eb;background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.04)}
        .grid{display:grid;gap:12px}
        .row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        @media (max-width:900px){ .row{grid-template-columns:repeat(2,minmax(0,1fr));} }
        .field{display:grid;gap:6px}
        .lab{font-size:.9rem;color:#111827;font-weight:600}
        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}
        .chip.on{background:#0f172a;color:#fff;border-color:#0f172a}
        .select{border:1px solid #d1d5db;border-radius:12px;padding:10px 12px}
        .actions{display:flex;justify-content:flex-end}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
        @media (max-width:900px){ .grid2{grid-template-columns:1fr;} }
        .stat .row2{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .k{font-size:12px;color:#64748b}
        .v{font-weight:800}
        .h3{margin:0 0 10px}
        .tbl{width:100%;border-collapse:collapse}
        .tbl th,.tbl td{border:1px solid #e5e7eb;padding:8px;text-align:center}
        .spacer{display:none}
      `}</style>
    </main>
  );
}

function Recommendations({ goal }: { goal: Goal }) {
  const foods =
    goal === "bulk"
      ? {
          protein: ["Chicken thighs/breast", "Ground beef 10–15%", "Eggs", "Greek yogurt", "Whey protein"],
          carbs: ["Rice", "Oats", "Pasta", "Bagels", "Potatoes"],
          fats: ["Olive oil", "Avocado", "Nuts & nut butters", "Cheese"],
          produce: ["Bananas", "Berries", "Leafy greens", "Peppers"],
        }
      : goal === "cut"
      ? {
          protein: ["Chicken breast", "Lean beef 5–10%", "Egg whites", "White fish", "Low-fat Greek yogurt", "Whey isolate"],
          carbs: ["Rice cakes", "Berries", "Oats", "Potatoes", "Whole-grain wraps"],
          fats: ["Olive oil (measure)", "Avocado (small portions)", "Almonds (weigh)"],
          produce: ["Big salads", "Cruciferous veg", "Cucumbers", "Zucchini"],
        }
      : {
          protein: ["Chicken/turkey", "Eggs", "Fish", "Greek yogurt", "Tofu/tempeh"],
          carbs: ["Rice", "Oats", "Whole-grain bread", "Quinoa", "Fruit"],
          fats: ["Olive oil", "Nuts", "Seeds", "Avocado"],
          produce: ["Mixed veg", "Berries", "Leafy greens"],
        };

  const products = [
    "Kitchen food scale",
    "Meal-prep containers",
    "Water bottle (1–2 L)",
    "Creatine monohydrate (3–5 g/day)*",
    "Whey or plant protein*",
    "Resistance bands / basic dumbbells",
  ];

  const workouts =
    goal === "bulk"
      ? [
          { name: "Upper/Lower x4 days", detail: "8–12 reps, 3–4 sets, progressive overload" },
          { name: "Push/Pull/Legs x5–6 days", detail: "Compound focus; track lifts weekly" },
          { name: "Full-body x3 days", detail: "Heavy compounds + accessories" },
        ]
      : goal === "cut"
      ? [
          { name: "Full-body x3–4 days", detail: "Lower reps on compounds to maintain strength" },
          { name: "Upper/Lower x4 days", detail: "Add 2–3 cardio sessions (20–30 min)" },
          { name: "Circuits x3 days", detail: "Supersets; RPE 7–8; 10k steps/day" },
        ]
      : [
          { name: "Full-body x3 days", detail: "Strength + mobility; progressive but relaxed" },
          { name: "Upper/Lower x4 days", detail: "Moderate volume; deloads as needed" },
          { name: "Hybrid", detail: "2 strength + 2 cardio (zone 2) per week" },
        ];

  return (
    <section className="recs">
      <div className="card">
        <h3 className="h3">Foods to prioritize</h3>
        <div className="grid4">
          <List title="Protein" items={foods.protein} />
          <List title="Carbs" items={foods.carbs} />
          <List title="Fats" items={foods.fats} />
          <List title="Produce" items={foods.produce} />
        </div>
      </div>

      <div className="card">
        <h3 className="h3">Helpful products</h3>
        <ul className="list">
          {products.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="muted small">* Supplements are optional. Check for allergies/contraindications.</p>
      </div>

      <div className="card">
        <h3 className="h3">Workout ideas</h3>
        <ul className="list">
          {workouts.map((w) => (
            <li key={w.name}>
              <strong>{w.name}:</strong> {w.detail}
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        .recs{display:grid;gap:16px;margin-top:12px}
        .card{border:1px solid #e5e7eb;background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.04)}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media (max-width:900px){ .grid4{grid-template-columns:repeat(2,1fr);} }
        @media (max-width:600px){ .grid4{grid-template-columns:1fr;} }
        .list{margin:0;padding-left:18px}
        .small{font-size:12px}
      `}</style>
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="h4">{title}</h4>
      <ul className="list">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <style jsx>{`
        .h4{margin:0 0 6px}
        .list{margin:0;padding-left:18px}
      `}</style>
    </div>
  );
}
