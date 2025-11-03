"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";
import FitnessHeader from "@/components/fitness/FitnessHeader";
import WorkoutGrid from "@/components/fitness/WorkoutGrid";
import Meter from "@/components/ui/Meter";
import Button from "@/components/ui/Button";
import { useDebounce } from "@/hooks/useDebounce";
import { useTodayPlanner } from "@/hooks/useTodayPlanner";
import {
  Goal,
  Activity,
  mifflinStJeor,
  tdee,
  targetCalories,
  macroTargets,
  goalSuitability,
} from "@/lib/fitness/calc";
import { getMetrics, saveMetrics, type Metrics } from "@/lib/fitness/store";

type Form = {
  sex: "male" | "female";
  age: number | "";
  heightCm: number | "";
  weightKg: number | "";
  activity: Activity;
  goal: Goal;
};

const activityLabels: Record<Activity, string> = {
  sedentary: "Sedentary",
  light: "Light (1-3x/week)",
  moderate: "Moderate (3-5x/week)",
  active: "Active (6-7x/week)",
  veryActive: "Very active",
};

export default function FitnessPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 450);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>({
    sex: "male",
    age: 24,
    heightCm: 178,
    weightKg: 75,
    activity: "moderate",
    goal: "maintain",
  });
  const ageRef = useRef<HTMLInputElement | null>(null);

  const planner = useTodayPlanner(form.goal);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const metrics = await getMetrics();
        if (!alive || !metrics) {
          if (alive) setEditing(true);
          return;
        }
        if (!alive) return;
        setForm({
          sex: (metrics.sex ?? "male") as Form["sex"],
          age: Number(metrics.age ?? 24),
          heightCm: Number(metrics.heightCm ?? 178),
          weightKg: Number(metrics.weightKg ?? 75),
          activity: (metrics.activity ?? "moderate") as Activity,
          goal: (metrics.goal ?? "maintain") as Goal,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!editing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      ageRef.current?.focus();
    }, 60);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setEditing(false);
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [editing]);

  const numbersReady = form.age !== "" && form.heightCm !== "" && form.weightKg !== "";

  const bmr = useMemo(() => {
    if (!numbersReady) return 0;
    return mifflinStJeor(form.sex, Number(form.age), Number(form.heightCm), Number(form.weightKg));
  }, [form, numbersReady]);

  const tdeeVal = useMemo(() => (bmr ? tdee(bmr, form.activity) : 0), [bmr, form.activity]);
  const calTarget = useMemo(() => (tdeeVal ? targetCalories(tdeeVal, form.goal) : 0), [tdeeVal, form.goal]);
  const macros = useMemo(
    () =>
      calTarget
        ? macroTargets(Number(form.weightKg || 0), form.goal, calTarget)
        : { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
    [calTarget, form.goal, form.weightKg]
  );
  const suitability = useMemo(() => goalSuitability(Number(form.age || 0), form.goal), [form.age, form.goal]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: Metrics = {
        sex: form.sex,
        age: Number(form.age) || 0,
        heightCm: Number(form.heightCm) || 0,
        weightKg: Number(form.weightKg) || 0,
        activity: form.activity,
        goal: form.goal,
      };
      await saveMetrics(payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container as="main" className="fitnessPage">
      <FitnessHeader search={search} onSearchChange={setSearch} onClearSearch={() => setSearch("")} />

      {loading ? (
        <div className="loading">
          <div className="spinner" aria-hidden="true" />
          <p>Loading your metrics…</p>
        </div>
      ) : (
        <>
          <section className="metrics">
            <article className="card hero">
              <div className="heroHead">
                <div>
                  <p className="eyebrow">Personal plan</p>
                  <h2>Your daily targets</h2>
                </div>
                <div className="heroActions">
                  <Link href="/fitness/day" className="heroPlanner">
                    Today&apos;s planner
                  </Link>
                  <Button
                    type="button"
                    variant={editing ? "secondary" : "primary"}
                    onClick={() => setEditing((prev) => !prev)}
                  >
                    {editing ? "Close" : "Edit metrics"}
                  </Button>
                </div>
              </div>
              <div className="heroContent">
                <div className="heroSummary">
                  <div className="row">
                    <div>
                      <span className="label">Goal</span>
                      <strong>{titleCase(form.goal)}</strong>
                    </div>
                    <div>
                      <span className="label">Activity</span>
                      <strong>{activityLabels[form.activity]}</strong>
                    </div>
                    <div>
                      <span className="label">Weight</span>
                      <strong>{numbersReady ? `${form.weightKg} kg` : "—"}</strong>
                    </div>
                    <div>
                      <span className="label">Height</span>
                      <strong>{numbersReady ? `${form.heightCm} cm` : "—"}</strong>
                    </div>
                  </div>
                </div>
                <div className="heroMeter">
                  <Meter status={suitability.status} label="Goal suitability" message={suitability.message} />
                </div>
              </div>
            </article>

            <div className="metricsGrid">
              <article className="card stat">
                <h3>Energy budget</h3>
                <div className="statGrid">
                  <Metric label="BMR" value={bmr ? `${bmr} kcal` : "—"} />
                  <Metric label="TDEE" value={tdeeVal ? `${tdeeVal} kcal` : "—"} />
                  <Metric label="Target calories" value={macros.calories ? `${macros.calories} kcal` : "—"} />
                </div>
              </article>
              <article className="card stat">
                <h3>Macro guide</h3>
                <div className="macroGrid">
                  <Macro label="Protein" grams={macros.proteinG} />
                  <Macro label="Fat" grams={macros.fatG} />
                  <Macro label="Carbs" grams={macros.carbsG} />
                </div>
              </article>
            </div>

          </section>

          <section className="todaySection">
            <article className="card todayCard">
              <div className="todayHead">
                <div>
                  <p className="eyebrow">Today&apos;s planner</p>
                  <h3>Workouts for {planner.goal}</h3>
                </div>
                <Link href="/fitness/day" className="manageLink">
                  Open planner
                </Link>
              </div>
              {planner.error ? <div className="alertInline">{planner.error}</div> : null}
              <div className="todayBody">
                {planner.loading ? (
                  <p className="muted">Loading today&apos;s plan…</p>
                ) : planner.items.length ? (
                  <ul className="todayList">
                    {planner.items.map((item) => (
                      <li key={item.id} className={item.done ? "done" : ""}>
                        <div className="itemRow">
                          <span className="dot" aria-hidden="true" />
                          <span className="name">{item.name}</span>
                        </div>
                        {item.tags.length ? (
                          <div className="tagRow">
                            {item.tags.map((tag) => (
                              <span key={tag} className="tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">We&apos;ll keep this updated with goal-based movements.</p>
                )}
              </div>
              {planner.populating ? <p className="muted small">Personalizing your plan…</p> : null}
              {planner.suggestions.length ? (
                <div className="suggestions">
                  <div className="suggestHead">
                    <h4>Suggested add-ons</h4>
                    <span className="muted small">Tap to schedule</span>
                  </div>
                  <div className="suggestGrid">
                    {planner.suggestions.slice(0, 6).map((workout) => (
                      <button
                        key={workout.id}
                        type="button"
                        className="suggestBtn"
                        disabled={planner.adding}
                        onClick={() => planner.addToPlanner(workout)}
                      >
                        <span className="title">{workout.title}</span>
                        <span className="meta">
                          {[workout.bodyPart, workout.target, workout.equipment]
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(" • ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>

            <article className="card recipesCard">
              <div className="todayHead">
                <div>
                  <p className="eyebrow">Daily fuel</p>
                  <h3>Today&apos;s recipes</h3>
                </div>
                <Link href="/fitness/day#meals" className="manageLink">
                  View meals
                </Link>
              </div>
              {planner.loading ? (
                <p className="muted">Loading recipes…</p>
              ) : (
                <ul className="recipeList">
                  {planner.recipes.map((recipe) => (
                    <li key={recipe.id}>
                      <div className="recipeMedia">
                        {recipe.image ? (
                          <Image src={recipe.image} alt={recipe.title} fill sizes="64px" />
                        ) : (
                          <span className="placeholder" aria-hidden="true">🍽️</span>
                        )}
                      </div>
                      <div>
                        <span className="recipeTitle">{recipe.title}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <WorkoutGrid searchTerm={debouncedSearch} onClearSearch={() => setSearch("")} />
        </>
      )}

      {editing ? (
        <div
          className="metricsOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Edit fitness metrics"
          onClick={() => setEditing(false)}
        >
          <div className="metricsModal" onClick={(event) => event.stopPropagation()}>
            <header className="modalHead">
              <div>
                <p className="eyebrow">Update inputs</p>
                <h3>Edit your metrics</h3>
              </div>
              <button type="button" className="modalClose" onClick={() => setEditing(false)}>
                Close
              </button>
            </header>
            <form className="modalForm" onSubmit={onSave}>
              <fieldset>
                <legend>Sex</legend>
                <div className="chips">
                  {(["male", "female"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={form.sex === option ? "chip on" : "chip"}
                      onClick={() => update("sex", option)}
                    >
                      {titleCase(option)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                <span>Age</span>
                <input
                  ref={ageRef}
                  type="number"
                  inputMode="numeric"
                  value={form.age}
                  onChange={(event) => update("age", safeNumber(event.target.value))}
                  placeholder="Age in years"
                />
              </label>
              <label>
                <span>Height (cm)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.heightCm}
                  onChange={(event) => update("heightCm", safeNumber(event.target.value))}
                  placeholder="Height in cm"
                />
              </label>
              <label>
                <span>Weight (kg)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.weightKg}
                  onChange={(event) => update("weightKg", safeNumber(event.target.value))}
                  placeholder="Weight in kg"
                />
              </label>
              <label>
                <span>Activity level</span>
                <select value={form.activity} onChange={(event) => update("activity", event.target.value as Activity)}>
                  {Object.entries(activityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>Goal</legend>
                <div className="chips">
                  {(["cut", "maintain", "bulk"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={form.goal === option ? "chip on" : "chip"}
                      onClick={() => update("goal", option)}
                    >
                      {titleCase(option)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="modalActions">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save metrics"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .fitnessPage {
          display: grid;
          gap: 28px;
          padding-bottom: 96px;
        }
        .loading {
          border: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 20px;
          padding: 48px;
          display: grid;
          place-items: center;
          gap: 16px;
          color: var(--muted);
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid color-mix(in oklab, var(--border) 70%, transparent);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .metrics {
          display: grid;
          gap: 24px;
        }
        .card {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 24px;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
          padding: 24px;
        }
        .hero {
          display: grid;
          gap: 20px;
        }
        .heroHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .heroActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .heroPlanner {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding: 8px 16px;
          font-weight: 600;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 94%, transparent);
          text-decoration: none;
          transition: transform .12s ease, box-shadow .18s ease;
        }
        .heroPlanner:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
        }
        .heroHead h2 {
          margin: 4px 0 0;
          font-size: 1.7rem;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        .eyebrow {
          margin: 0;
          font-size: 0.75rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        .heroContent {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .heroSummary {
          display: grid;
          gap: 12px;
        }
        .row {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        .label {
          display: block;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
          font-weight: 700;
        }
        strong {
          font-size: 1.05rem;
          color: var(--text);
        }
        .heroMeter {
          min-height: 120px;
        }
        .metricsGrid {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .stat h3 {
          margin: 0 0 16px;
          font-size: 1.1rem;
          color: var(--text);
        }
        .statGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        .macroGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: transparent;
          color: var(--text);
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .chip.on {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--primary-contrast);
          box-shadow: 0 16px 40px color-mix(in oklab, var(--primary) 35%, transparent);
        }
        .metricsOverlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.6);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 1200;
        }
        .metricsModal {
          width: min(720px, 100%);
          max-height: 90vh;
          overflow: hidden;
          background: var(--bg2);
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          box-shadow: 0 36px 120px rgba(15, 23, 42, 0.32);
          display: grid;
          grid-template-rows: auto 1fr;
        }
        .modalHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          border-bottom: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
        }
        .modalHead h3 {
          margin: 6px 0 0;
          font-size: 1.2rem;
          color: var(--text);
        }
        .modalClose {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: var(--bg);
          color: var(--text);
          border-radius: 999px;
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .modalForm {
          display: grid;
          gap: 16px;
          padding: 24px;
          overflow-y: auto;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .modalForm fieldset,
        .modalForm label {
          display: grid;
          gap: 8px;
          border: 0;
          padding: 0;
          margin: 0;
        }
        .modalForm legend,
        .modalForm span {
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        .modalForm input,
        .modalForm select {
          border-radius: 12px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: var(--bg2);
          color: var(--text);
          padding: 10px 12px;
          font: inherit;
        }
        .modalActions {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }
        .todaySection {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }
        .todayCard,
        .recipesCard {
          display: grid;
          gap: 18px;
        }
        .todayHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .todayHead h3 {
          margin: 4px 0 0;
          font-size: 1.18rem;
          color: var(--text);
        }
        .manageLink {
          font-size: 0.85rem;
          color: var(--primary);
          font-weight: 600;
        }
        .todayBody {
          display: grid;
          gap: 12px;
        }
        .todayList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .todayList li {
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 16px;
          padding: 12px 14px;
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          display: grid;
          gap: 6px;
        }
        .todayList li.done {
          opacity: 0.7;
        }
        .itemRow {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--primary);
          flex-shrink: 0;
        }
        .name {
          font-weight: 700;
          color: var(--text);
        }
        .tagRow {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tag {
          font-size: 0.72rem;
          border-radius: 999px;
          padding: 3px 8px;
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
        }
        .suggestions {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }
        .suggestHead {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .suggestGrid {
          display: grid;
          gap: 10px;
        }
        .suggestBtn {
          border-radius: 16px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: linear-gradient(180deg, color-mix(in oklab, var(--bg) 94%, transparent), var(--bg2));
          padding: 12px 14px;
          text-align: left;
          display: grid;
          gap: 4px;
          cursor: pointer;
        }
        .suggestBtn:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
        }
        .suggestBtn .title {
          font-weight: 700;
          color: var(--text);
        }
        .suggestBtn .meta {
          font-size: 0.78rem;
          color: var(--muted);
        }
        .recipesCard .recipeList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .recipeList li {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 12px;
          align-items: center;
        }
        .recipeMedia {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          overflow: hidden;
          background: color-mix(in oklab, var(--bg) 88%, transparent);
        }
        .recipeMedia :global(img) {
          object-fit: cover;
        }
        .placeholder {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          font-size: 24px;
        }
        .recipeTitle {
          font-weight: 600;
          color: var(--text);
        }
        .alertInline {
          border-radius: 14px;
          border: 1px solid color-mix(in oklab, #ef4444 35%, transparent);
          background: color-mix(in oklab, #fee2e2 45%, transparent);
          color: #991b1b;
          padding: 10px 12px;
          font-size: 0.85rem;
        }
        .muted.small {
          font-size: 0.8rem;
        }
        @media (max-width: 720px) {
          .metricsModal {
            max-height: 100vh;
          }
          .modalActions {
            justify-content: stretch;
          }
          .modalActions :global(button) {
            flex: 1 1 auto;
          }
          .todaySection {
            grid-template-columns: 1fr;
          }
          .suggestBtn {
            padding: 12px;
          }
        }
      `}</style>
    </Container>
  );
}

type MetricProps = { label: string; value: string };

function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <style jsx>{`
        .metric {
          border-radius: 16px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
          padding: 16px;
          display: grid;
          gap: 6px;
        }
        span {
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        strong {
          font-size: 1.3rem;
        }
      `}</style>
    </div>
  );
}

type MacroProps = { label: string; grams: number };

function Macro({ label, grams }: MacroProps) {
  return (
    <div className="macro">
      <span>{label}</span>
      <strong>{grams ? `${grams} g` : "—"}</strong>
      <style jsx>{`
        .macro {
          border-radius: 16px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          padding: 16px;
          display: grid;
          gap: 6px;
        }
        span {
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        strong {
          font-size: 1.3rem;
        }
      `}</style>
    </div>
  );
}

function safeNumber(value: string): number | "" {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""))
    .join(" ");
}
