"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import FitnessHeader from "@/components/fitness/FitnessHeader";
import WorkoutGrid from "@/components/fitness/WorkoutGrid";
import Button from "@/components/ui/Button";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Goal,
  Activity,
  mifflinStJeor,
  tdee,
  targetCalories,
  macroTargets,
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
          <div className="metricsBar">
            <div className="metricsLeft">
              <p className="eyebrow">Your plan · {titleCase(form.goal)}</p>
              {numbersReady ? (
                <div className="statsRow">
                  <StatPill label="Target" value={macros.calories ? `${macros.calories} kcal` : "—"} />
                  <StatPill label="Protein" value={macros.proteinG ? `${macros.proteinG} g` : "—"} />
                  <StatPill label="Fat" value={macros.fatG ? `${macros.fatG} g` : "—"} />
                  <StatPill label="Carbs" value={macros.carbsG ? `${macros.carbsG} g` : "—"} />
                </div>
              ) : (
                <p className="setupHint">Add your stats to unlock personalized targets.</p>
              )}
            </div>
            <div className="metricsRight">
              <Link href="/fitness/day" className="plannerBtn">Today&apos;s planner</Link>
              <button type="button" className="editMetricsBtn" onClick={() => setEditing(true)}>
                {numbersReady ? "Edit" : "Set up"}
              </button>
            </div>
          </div>

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
          gap: 24px;
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
        .metricsBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 20px;
          padding: 16px 20px;
        }
        .eyebrow {
          margin: 0 0 10px;
          font-size: 0.72rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        .statsRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .metricsRight {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          align-items: center;
        }
        .plannerBtn {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 9px 18px;
          font-weight: 700;
          color: var(--primary-contrast);
          background: var(--primary);
          text-decoration: none;
          font-size: 0.9rem;
          box-shadow: 0 10px 28px color-mix(in oklab, var(--primary) 28%, transparent);
          transition: filter 0.15s ease;
        }
        .plannerBtn:hover { filter: brightness(1.07); }
        .editMetricsBtn {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: transparent;
          color: var(--text);
          padding: 9px 18px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.15s ease;
        }
        .editMetricsBtn:hover {
          background: color-mix(in oklab, var(--bg) 80%, transparent);
        }
        .setupHint {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
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
        .modalActions {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }
        @media (max-width: 720px) {
          .metricsBar {
            gap: 12px;
          }
          .metricsRight {
            width: 100%;
            justify-content: flex-end;
          }
          .metricsModal {
            max-height: 100vh;
          }
          .modalActions {
            justify-content: stretch;
          }
          .modalActions :global(button) {
            flex: 1 1 auto;
          }
        }
      `}</style>
    </Container>
  );
}

type StatPillProps = { label: string; value: string };

function StatPill({ label, value }: StatPillProps) {
  return (
    <div className="pill">
      <span className="label">{label}</span>
      <strong>{value}</strong>
      <style jsx>{`
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: color-mix(in oklab, var(--bg) 90%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 999px;
          padding: 6px 12px;
        }
        .label {
          font-size: 0.7rem;
          color: var(--muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        strong {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text);
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
