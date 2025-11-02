"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import Meter from "@/components/ui/Meter";
import {
  Goal,
  Activity,
  mifflinStJeor,
  tdee,
  targetCalories,
  macroTargets,
  goalSuitability,
} from "@/lib/fitness/calc";
import { getMetrics, saveMetrics, Metrics } from "@/lib/fitness/store";
import WorkoutGrid from "@/components/fitness/WorkoutGrid";

type Form = {
  sex: "male" | "female";
  age: number | "";
  heightCm: number | "";
  weightKg: number | "";
  activity: Activity;
  goal: Goal;
};

export default function FitnessPage() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Form>({
    sex: "male",
    age: 24,
    heightCm: 178,
    weightKg: 75,
    activity: "moderate",
    goal: "maintain",
  });

  useEffect(() => {
    (async () => {
      try {
        const metrics = await getMetrics();
        if (metrics) {
          setF({
            sex: (metrics.sex ?? "male") as Form["sex"],
            age: Number(metrics.age ?? 24),
            heightCm: Number(metrics.heightCm ?? 178),
            weightKg: Number(metrics.weightKg ?? 75),
            activity: (metrics.activity ?? "moderate") as Activity,
            goal: (metrics.goal ?? "maintain") as Goal,
          });
        } else {
          setEditing(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bmr = useMemo(() => {
    if (f.age === "" || f.heightCm === "" || f.weightKg === "") return 0;
    return mifflinStJeor(f.sex, Number(f.age), Number(f.heightCm), Number(f.weightKg));
  }, [f]);

  const tdeeVal = useMemo(() => (bmr ? tdee(bmr, f.activity) : 0), [bmr, f.activity]);
  const calTarget = useMemo(() => (tdeeVal ? targetCalories(tdeeVal, f.goal) : 0), [tdeeVal, f.goal]);
  const macros = useMemo(() => (calTarget ? macroTargets(Number(f.weightKg || 0), f.goal, calTarget) : {
    calories: 0, proteinG: 0, fatG: 0, carbsG: 0
  }), [f, calTarget]);
  const suitability = useMemo(() => goalSuitability(Number(f.age || 0), f.goal), [f.age, f.goal]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: Metrics = {
      sex: f.sex,
      age: Number(f.age) || 0,
      heightCm: Number(f.heightCm) || 0,
      weightKg: Number(f.weightKg) || 0,
      activity: f.activity,
      goal: f.goal,
    };
    await saveMetrics(payload);
    setEditing(false);
  }

  return (
    <Container as="main" className="fitnessShell">
      {loading ? (
        <div className="loadingState">
          <p className="muted">Loading&hellip;</p>
        </div>
      ) : (
        <>
          <PageHeader
            title="Fitness"
            subtitle="Calories, macros, and your daily workout planner."
            actions={
              <Button
                type="button"
                variant={editing ? "secondary" : "primary"}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "Close" : "Edit my data"}
              </Button>
            }
          />

          {editing ? (
            <section className="sectionCard">
              <h3 className="sectionTitle">Your metrics</h3>
              <form className="formGrid" onSubmit={onSave}>
                <div className="field">
                  <span className="fieldLabel">Sex</span>
                  <div className="chips">
                    {(["male", "female"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`chip ${f.sex === value ? "on" : ""}`}
                        onClick={() => update("sex", value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="fieldLabel" htmlFor="fitness-age">Age</label>
                  <input
                    id="fitness-age"
                    className="control"
                    type="number"
                    value={f.age}
                    onChange={(e) => {
                      const val = e.target.value;
                      update("age", val === "" ? "" : Number(val));
                    }}
                    placeholder="Enter your age"
                  />
                </div>

                <div className="field">
                  <label className="fieldLabel" htmlFor="fitness-height">Height (cm)</label>
                  <input
                    id="fitness-height"
                    className="control"
                    type="number"
                    value={f.heightCm}
                    onChange={(e) => {
                      const val = e.target.value;
                      update("heightCm", val === "" ? "" : Number(val));
                    }}
                    placeholder="Enter your height"
                  />
                </div>

                <div className="field">
                  <label className="fieldLabel" htmlFor="fitness-weight">Weight (kg)</label>
                  <input
                    id="fitness-weight"
                    className="control"
                    type="number"
                    value={f.weightKg}
                    onChange={(e) => {
                      const val = e.target.value;
                      update("weightKg", val === "" ? "" : Number(val));
                    }}
                    placeholder="Enter your weight"
                  />
                </div>

                <div className="field">
                  <label className="fieldLabel" htmlFor="fitness-activity">Activity</label>
                  <select
                    id="fitness-activity"
                    className="control"
                    value={f.activity}
                    onChange={(e) => update("activity", e.target.value as Activity)}
                  >
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light (1-3x / week)</option>
                    <option value="moderate">Moderate (3-5x / week)</option>
                    <option value="active">Active (6-7x / week)</option>
                    <option value="veryActive">Very active</option>
                  </select>
                </div>

                <div className="field">
                  <span className="fieldLabel">Goal</span>
                  <div className="chips">
                    {(["cut", "maintain", "bulk"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`chip ${f.goal === value ? "on" : ""}`}
                        onClick={() => update("goal", value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="formActions">
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="panelRow">
            <div className="meterWrap">
              <Meter
                status={suitability.status}
                label="Goal suitability"
                message={suitability.message}
              />
            </div>
            <div className="sectionCard statCard">
              <h3 className="sectionTitle">Energy targets</h3>
              <div className="statGrid">
                <div className="statMetric">
                  <span className="statLabel">BMR</span>
                  <span className="statValue">{bmr} kcal</span>
                </div>
                <div className="statMetric">
                  <span className="statLabel">TDEE</span>
                  <span className="statValue">{tdeeVal} kcal</span>
                </div>
                <div className="statMetric">
                  <span className="statLabel">Target calories</span>
                  <span className="statValue">{macros.calories} kcal</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panelRow">
            <div className="sectionCard tableCard">
              <h3 className="sectionTitle">Daily macros</h3>
              <table className="macrosTable">
                <thead>
                  <tr>
                    <th scope="col">Calories</th>
                    <th scope="col">Protein</th>
                    <th scope="col">Fat</th>
                    <th scope="col">Carbs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{macros.calories}</td>
                    <td>{macros.proteinG} g</td>
                    <td>{macros.fatG} g</td>
                    <td>{macros.carbsG} g</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="sectionCard plannerCard">
              <h3 className="sectionTitle">Today&apos;s planner</h3>
              <p className="muted">
                Review your checklist, mark workouts complete, and see recipe ideas.
              </p>
              <Link className="cta" href="/fitness/day">
                Open today&apos;s planner
              </Link>
            </div>
          </section>

          <section className="library">
            <WorkoutGrid
              initialBodyPart={
                f.goal === "bulk"
                  ? "upper legs"
                  : f.goal === "cut"
                  ? "cardio"
                  : "back"
              }
              title="Movement library"
              goal={f.goal}
            />
          </section>
        </>
      )}

      <style jsx>{`
        .fitnessShell {
          display: grid;
          gap: 24px;
          padding-block: 24px 72px;
        }
        @media (max-width: 640px) {
          .fitnessShell {
            gap: 18px;
            padding-block: 16px 60px;
          }
        }
        @media (max-width: 480px) {
          .fitnessShell {
            gap: 16px;
            padding-block: 14px 48px;
          }
        }
        .muted { color: var(--muted); }
        .loadingState {
          min-height: 200px;
          display: grid;
          place-items: center;
          border: 1px dashed color-mix(in oklab, var(--border) 85%, transparent);
          border-radius: 18px;
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
        }
        .sectionCard {
          border: 1px solid var(--border);
          background: linear-gradient(180deg, color-mix(in oklab, var(--card-bg) 95%, transparent), var(--card-bg));
          border-radius: 20px;
          padding: 20px;
          box-shadow: var(--shadow);
          display: grid;
          gap: 16px;
        }
        @media (max-width: 640px) {
          .sectionCard {
            border-radius: 16px;
            padding: 16px;
            gap: 14px;
          }
        }
        @media (max-width: 480px) {
          .sectionCard {
            padding: 14px;
            gap: 12px;
          }
        }
        .sectionTitle {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        @media (max-width: 480px) {
          .sectionTitle {
            font-size: 0.95rem;
          }
        }
        .panelRow {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          align-items: stretch;
        }
        @media (max-width: 720px) {
          .panelRow {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
        @media (max-width: 480px) {
          .panelRow {
            gap: 14px;
          }
        }
        @media (max-width: 360px) {
          .panelRow {
            gap: 12px;
          }
        }
        .panelRow > * {
          min-width: 0;
        }
        @media (max-width: 640px) {
          .panelRow .statCard {
            order: 2;
          }
          .panelRow .meterWrap {
            order: 1;
          }
        }
        @media (max-width: 480px) {
          .panelRow .statCard,
          .panelRow .meterWrap {
            order: unset;
          }
        }
        .meterWrap {
          min-width: 0;
        }
        .statCard { gap: 18px; }
        .statGrid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }
        @media (max-width: 600px) {
          .statGrid {
            grid-template-columns: 1fr;
          }
        }
        .statMetric {
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          border-radius: 16px;
          padding: 14px 16px;
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
          display: grid;
          gap: 8px;
        }
        @media (max-width: 480px) {
          .statMetric {
            padding: 12px;
            gap: 6px;
          }
        }
        @media (max-width: 360px) {
          .statMetric {
            padding: 10px;
          }
        }
        .statLabel {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
        }
        .statValue {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--text);
        }
        @media (max-width: 480px) {
          .statValue {
            font-size: 1.35rem;
          }
        }
        @media (max-width: 360px) {
          .statValue {
            font-size: 1.2rem;
          }
        }
        .formGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
        }
        @media (max-width: 640px) {
          .formGrid {
            gap: 14px;
          }
        }
        @media (max-width: 540px) {
          .formGrid {
            grid-template-columns: 1fr;
          }
        }
        .field {
          display: grid;
          gap: 10px;
        }
        .fieldLabel {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .control {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 10px 12px;
          width: 100%;
          background: var(--bg2);
          color: var(--text);
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .control:focus {
          border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 45%, transparent);
          background: var(--bg);
        }
        @media (max-width: 480px) {
          .control {
            padding: 9px 12px;
            font-size: 0.95rem;
          }
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        @media (max-width: 500px) {
          .chips {
            gap: 6px;
          }
          .chip {
            flex: 1 1 calc(50% - 6px);
          }
        }
        .chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, var(--primary) 20%);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          color: var(--text);
          font-weight: 600;
          padding: 7px 14px;
          text-transform: capitalize;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .chip.on {
          border-color: var(--primary);
          background: color-mix(in oklab, var(--primary) 22%, var(--bg2));
          color: var(--primary-contrast);
          box-shadow: 0 8px 24px color-mix(in oklab, var(--primary) 30%, transparent);
        }
        .chip:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 50%, transparent);
        }
        .formActions {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
        }
        @media (max-width: 640px) {
          .formActions {
            justify-content: flex-start;
          }
          .formActions :global(button) {
            width: 100%;
          }
        }
        .tableCard table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 16px;
          overflow: hidden;
        }
        @media (max-width: 640px) {
          .tableCard {
            overflow-x: auto;
          }
          .tableCard table {
            min-width: 420px;
          }
        }
        @media (max-width: 480px) {
          .tableCard table {
            min-width: 360px;
          }
        }
        @media (max-width: 360px) {
          .tableCard table {
            min-width: 320px;
          }
        }
        .macrosTable th,
        .macrosTable td {
          padding: 12px;
          text-align: center;
          border: 1px solid color-mix(in oklab, var(--border) 92%, transparent);
        }
        .macrosTable th {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          background: color-mix(in oklab, var(--bg2) 95%, transparent);
        }
        .macrosTable td {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 90%, transparent);
        }
        @media (max-width: 480px) {
          .macrosTable th,
          .macrosTable td {
            padding: 10px;
            font-size: 0.95rem;
          }
        }
        @media (max-width: 360px) {
          .macrosTable th,
          .macrosTable td {
            padding: 8px;
            font-size: 0.9rem;
          }
        }
        .plannerCard {
          justify-content: space-between;
        }
        .plannerCard p {
          margin: 0;
        }
        @media (max-width: 540px) {
          .plannerCard {
            gap: 12px;
          }
        }
        @media (max-width: 480px) {
          .plannerCard {
            align-items: stretch;
          }
        }
        .cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--primary-contrast);
          font-weight: 700;
          border: 1px solid var(--primary);
          text-decoration: none;
          width: fit-content;
          transition: transform 0.12s ease, filter 0.18s ease;
        }
        @media (max-width: 640px) {
          .cta {
            width: 100%;
            justify-content: center;
          }
        }
        .cta:hover { filter: brightness(1.05); }
        .cta:active { transform: translateY(1px); }
        .meterWrap :global(.card) { height: 100%; }
        @media (max-width: 720px) {
          .meterWrap :global(.card) {
            height: auto;
          }
        }
        .library { margin-top: 8px; }
      `}</style>
    </Container>
  );
}
