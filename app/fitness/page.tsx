"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import { addExerciseToToday, getMetrics, saveMetrics, type Metrics } from "@/lib/fitness/store";
import {
  type Activity,
  type Goal,
  mifflinStJeor,
  tdee,
  targetCalories,
  macroTargets,
} from "@/lib/fitness/calc";

type WorkoutMediaType = "gif" | "mp4" | "image";

type WorkoutContent = {
  id: string;
  title: string;
  mediaUrl: string | null;
  mediaType: WorkoutMediaType;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  description: string;
  instructionsHtml?: string | null;
  bodyPart?: string | null;
  target?: string | null;
  equipment?: string | null;
  source: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipmentList?: string[];
};

type WorkoutResponse = {
  items: WorkoutContent[];
  meta?: {
    nextOffset: number | null;
    sources?: string[];
  };
};

type QuickFilter = {
  label: string;
  bodyPart?: string;
  q?: string;
};

type FitnessForm = {
  sex: "male" | "female";
  age: number | "";
  heightCm: number | "";
  weightKg: number | "";
  activity: Activity;
  goal: Goal;
};

const DEFAULT_FORM: FitnessForm = {
  sex: "male",
  age: 24,
  heightCm: 178,
  weightKg: 75,
  activity: "moderate",
  goal: "maintain",
};

const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: "Little movement",
  light: "Light training",
  moderate: "3–5 workouts/week",
  active: "Hard training",
  veryActive: "Athlete level",
};

const GOAL_LABELS: Record<Goal, string> = {
  cut: "Lose fat",
  maintain: "Maintain",
  bulk: "Build muscle",
};

const QUICK_FILTERS: QuickFilter[] = [
  { label: "Full body", q: "squat" },
  { label: "Chest", bodyPart: "chest" },
  { label: "Back", bodyPart: "back" },
  { label: "Legs", bodyPart: "upper legs" },
  { label: "Core", bodyPart: "waist" },
  { label: "Cardio", bodyPart: "cardio" },
];

const BODY_PARTS = ["back", "cardio", "chest", "lower arms", "lower legs", "shoulders", "upper arms", "upper legs", "waist"];
const EQUIPMENT = ["body weight", "dumbbell", "barbell", "cable", "leverage machine", "assisted", "band"];

function titleCase(value?: string | null) {
  if (!value) return "Any";
  return value
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

function stripHtml(html?: string | null) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getExerciseCue(workout: WorkoutContent) {
  const target = workout.target ? titleCase(workout.target) : "target muscle";
  const equipment = workout.equipment ? titleCase(workout.equipment) : "Bodyweight";
  return `Focus: ${target}. Equipment: ${equipment}. Move slow, keep control, and stop if the movement hurts.`;
}

function getTutorialSearchUrl(workout: WorkoutContent) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${workout.title} exercise tutorial`)}`;
}

function getLevel(workout: WorkoutContent) {
  const name = workout.title.toLowerCase();
  const equipment = workout.equipment?.toLowerCase() || "";
  if (name.includes("assisted") || equipment.includes("body weight")) return "Beginner";
  if (equipment.includes("barbell") || equipment.includes("weighted")) return "Advanced";
  return "Intermediate";
}

function getBmiCategory(bmi: number) {
  if (!bmi) return { label: "Add stats", tone: "neutral", message: "Enter height and weight to calculate BMI." };
  if (bmi < 18.5) return { label: "Underweight", tone: "caution", message: "You may need a careful calorie surplus and strength plan." };
  if (bmi < 25) return { label: "Healthy range", tone: "good", message: "Good range. Choose a calorie target based on your goal." };
  if (bmi < 30) return { label: "Overweight", tone: "caution", message: "A small calorie deficit can support steady fat loss." };
  return { label: "Higher range", tone: "caution", message: "Start gradually and consider professional guidance if needed." };
}

function safeNumber(value: string): number | "" {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function buildUrl(query: string, bodyPart: string, equipment: string, offset = 0) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (bodyPart) params.set("bodyPart", bodyPart);
  if (equipment) params.set("equipment", equipment);
  params.set("limit", "12");
  if (offset) params.set("offset", String(offset));
  return `/api/workouts/search?${params.toString()}`;
}

function VisualMedia({ workout, large = false }: { workout: WorkoutContent; large?: boolean }) {
  const src = workout.mediaUrl || workout.previewUrl || workout.thumbnailUrl || null;

  if (src && workout.mediaType === "mp4") {
    return (
      <video className={large ? "exerciseMedia large" : "exerciseMedia"} src={src} muted loop playsInline controls={large} autoPlay={!large} />
    );
  }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={large ? "exerciseMedia large" : "exerciseMedia"}
        src={src}
        alt={`${workout.title} demonstration`}
        loading="lazy"
        onError={({ currentTarget }) => {
          if (currentTarget.src.endsWith("/placeholder.png")) return;
          currentTarget.src = "/placeholder.png";
        }}
      />
    );
  }

  return (
    <div className={large ? "exercisePlaceholder large" : "exercisePlaceholder"}>
      <span>Demo unavailable</span>
      <strong>{workout.title}</strong>
      <small>ExerciseDB returned instructions and muscle data, but no animated demo URL for this exercise.</small>
      <a
        className="placeholderLink"
        href={getTutorialSearchUrl(workout)}
        target="_blank"
        rel="noreferrer"
      >
        Search tutorial
      </a>
    </div>
  );
}

export default function FitnessPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [items, setItems] = useState<WorkoutContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutContent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metricsSaving, setMetricsSaving] = useState(false);
  const [fitnessForm, setFitnessForm] = useState<FitnessForm>(DEFAULT_FORM);

  useEffect(() => {
    let alive = true;

    async function loadMetrics() {
      const metrics = await getMetrics();
      if (!alive || !metrics) return;
      setFitnessForm({
        sex: (metrics.sex ?? DEFAULT_FORM.sex) as FitnessForm["sex"],
        age: typeof metrics.age === "number" ? metrics.age : DEFAULT_FORM.age,
        heightCm: typeof metrics.heightCm === "number" ? metrics.heightCm : DEFAULT_FORM.heightCm,
        weightKg: typeof metrics.weightKg === "number" ? metrics.weightKg : DEFAULT_FORM.weightKg,
        activity: (metrics.activity ?? DEFAULT_FORM.activity) as Activity,
        goal: (metrics.goal ?? DEFAULT_FORM.goal) as Goal,
      });
    }

    void loadMetrics();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(debouncedQuery, bodyPart, equipment), { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load workouts. Check your workout API key and try again.");
        const data = (await res.json()) as WorkoutResponse;
        if (!alive) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setNextOffset(data.meta?.nextOffset ?? null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load workouts.");
        setItems([]);
        setNextOffset(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [debouncedQuery, bodyPart, equipment]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const summary = useMemo(() => {
    const visible = items.length;
    const withGif = items.filter((item) => item.mediaUrl || item.previewUrl).length;
    return { visible, withGif };
  }, [items]);

  const numbersReady = fitnessForm.age !== "" && fitnessForm.heightCm !== "" && fitnessForm.weightKg !== "";

  const bmi = useMemo(() => {
    if (!fitnessForm.heightCm || !fitnessForm.weightKg) return 0;
    const heightM = Number(fitnessForm.heightCm) / 100;
    return Number((Number(fitnessForm.weightKg) / (heightM * heightM)).toFixed(1));
  }, [fitnessForm.heightCm, fitnessForm.weightKg]);

  const bmiInfo = useMemo(() => getBmiCategory(bmi), [bmi]);

  const bmr = useMemo(() => {
    if (!numbersReady) return 0;
    return mifflinStJeor(fitnessForm.sex, Number(fitnessForm.age), Number(fitnessForm.heightCm), Number(fitnessForm.weightKg));
  }, [fitnessForm, numbersReady]);

  const maintenanceCalories = useMemo(() => (bmr ? tdee(bmr, fitnessForm.activity) : 0), [bmr, fitnessForm.activity]);
  const calorieTarget = useMemo(() => (maintenanceCalories ? targetCalories(maintenanceCalories, fitnessForm.goal) : 0), [maintenanceCalories, fitnessForm.goal]);
  const macros = useMemo(
    () => calorieTarget ? macroTargets(Number(fitnessForm.weightKg || 0), fitnessForm.goal, calorieTarget) : { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
    [calorieTarget, fitnessForm.goal, fitnessForm.weightKg]
  );

  function updateFitnessForm<K extends keyof FitnessForm>(key: K, value: FitnessForm[K]) {
    setFitnessForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveFitnessMetrics(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMetricsSaving(true);
    try {
      const payload: Metrics = {
        sex: fitnessForm.sex,
        age: Number(fitnessForm.age) || 0,
        heightCm: Number(fitnessForm.heightCm) || 0,
        weightKg: Number(fitnessForm.weightKg) || 0,
        activity: fitnessForm.activity,
        goal: fitnessForm.goal,
      };
      await saveMetrics(payload);
      setMetricsOpen(false);
      setToast("Fitness profile updated");
    } finally {
      setMetricsSaving(false);
    }
  }

  async function loadMore() {
    if (nextOffset === null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(debouncedQuery, bodyPart, equipment, nextOffset), { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load more workouts.");
      const data = (await res.json()) as WorkoutResponse;
      setItems((prev) => [...prev, ...(Array.isArray(data.items) ? data.items : [])]);
      setNextOffset(data.meta?.nextOffset ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more workouts.");
    } finally {
      setLoading(false);
    }
  }

  async function addToToday(workout: WorkoutContent) {
    try {
      await addExerciseToToday({
        id: workout.id,
        name: workout.title,
        bodyPart: workout.bodyPart || undefined,
        target: workout.target || undefined,
        equipment: workout.equipment || undefined,
        gifUrl: workout.mediaUrl || undefined,
        descriptionHtml: workout.instructionsHtml ?? workout.description,
      });
      setToast(`Added ${workout.title} to today's planner`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not add exercise to today.");
    }
  }

  function applyQuickFilter(filter: QuickFilter) {
    setQuery(filter.q || "");
    setBodyPart(filter.bodyPart || "");
    setEquipment("");
  }

  return (
    <Container as="main" className="fitnessStudio">
      <section className="fitnessHero">
        <div>
          <p className="pageEyebrow">Workout library</p>
          <h1>Learn exercises with visual demos.</h1>
          <p className="heroText">
            Search by movement, muscle group, or equipment. Each card is designed to show what the workout is, what it trains,
            and how to start without getting confused.
          </p>
        </div>

        <div className="heroStats" aria-label="Workout result summary">
          <div>
            <strong>{summary.visible}</strong>
            <span>shown</span>
          </div>
          <div>
            <strong>{summary.withGif}</strong>
            <span>visual demos</span>
          </div>
          <div>
            <strong>{bodyPart ? titleCase(bodyPart) : "All"}</strong>
            <span>focus</span>
          </div>
        </div>
      </section>

      <section className="nutritionPlanner" aria-label="BMI and nutrition targets">
        <div className="nutritionMain">
          <div className="nutritionHeading">
            <p className="pageEyebrow">BMI + calories</p>
            <h2>Know what to eat for your goal.</h2>
            <p>Update your body stats once, then Clean Kitchen shows your BMI, maintenance calories, goal calories, and simple macro targets.</p>
          </div>

          <div className={`bmiCard ${bmiInfo.tone}`}>
            <span>BMI</span>
            <strong>{bmi ? bmi : "—"}</strong>
            <b>{bmiInfo.label}</b>
            <small>{bmiInfo.message}</small>
          </div>
        </div>

        <div className="nutritionStats">
          <div className="nutritionStat highlight">
            <span>Eat around</span>
            <strong>{macros.calories ? `${macros.calories}` : "—"}</strong>
            <small>kcal/day for {GOAL_LABELS[fitnessForm.goal].toLowerCase()}</small>
          </div>
          <div className="nutritionStat"><span>Maintenance</span><strong>{maintenanceCalories || "—"}</strong><small>kcal/day</small></div>
          <div className="nutritionStat"><span>Protein</span><strong>{macros.proteinG || "—"}</strong><small>grams/day</small></div>
          <div className="nutritionStat"><span>Carbs</span><strong>{macros.carbsG || "—"}</strong><small>grams/day</small></div>
          <div className="nutritionStat"><span>Fat</span><strong>{macros.fatG || "—"}</strong><small>grams/day</small></div>
        </div>

        <div className="nutritionActions">
          <button type="button" className="primaryAction" onClick={() => setMetricsOpen(true)}>
            {numbersReady ? "Edit BMI profile" : "Set up BMI profile"}
          </button>
          <p>Current profile: {fitnessForm.age || "—"} yrs · {fitnessForm.heightCm || "—"} cm · {fitnessForm.weightKg || "—"} kg · {ACTIVITY_LABELS[fitnessForm.activity]}</p>
        </div>
      </section>

      <section className="searchPanel" aria-label="Find workouts">
        <label className="searchBox">
          <span>Search workout</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try push-up, squat, curl..." />
        </label>

        <label className="selectBox">
          <span>Body part</span>
          <select value={bodyPart} onChange={(event) => setBodyPart(event.target.value)}>
            <option value="">Any body part</option>
            {BODY_PARTS.map((part) => (
              <option key={part} value={part}>
                {titleCase(part)}
              </option>
            ))}
          </select>
        </label>

        <label className="selectBox">
          <span>Equipment</span>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            <option value="">Any equipment</option>
            {EQUIPMENT.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </label>

        <Link href="/fitness/day" className="plannerAction">
          <strong>Open planner</strong>
        </Link>
      </section>

      <section className="quickStart" aria-label="Quick workout filters">
        <div>
          <p className="sectionLabel">Start simple</p>
          <h2>Pick a goal and see workouts instantly.</h2>
        </div>
        <div className="quickChips">
          {QUICK_FILTERS.map((filter) => {
            const active = (filter.bodyPart && filter.bodyPart === bodyPart) || (filter.q && filter.q === query);
            return (
              <button key={filter.label} type="button" className={active ? "quickChip active" : "quickChip"} onClick={() => applyQuickFilter(filter)}>
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <div className="errorBox">{error}</div> : null}

      <section className="workoutGrid" aria-live="polite">
        {loading && items.length === 0
          ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeletonCard" />)
          : items.map((workout) => (
              <article key={workout.id} className="workoutCard">
                <div className="mediaWrap">
                  <VisualMedia workout={workout} />
                  <span className="levelBadge">{getLevel(workout)}</span>
                </div>

                <div className="workoutBody">
                  <div className="workoutTitleRow">
                    <h3>{workout.title}</h3>
                    <span>{titleCase(workout.bodyPart)}</span>
                  </div>

                  <p>{workout.description || getExerciseCue(workout)}</p>

                  <div className="metaRow">
                    <span>{titleCase(workout.target)}</span>
                    <span>{titleCase(workout.equipment || "body weight")}</span>
                  </div>

                  <div className="cardActions">
                    <button type="button" className="primaryAction" onClick={() => setActiveWorkout(workout)}>
                      View demo
                    </button>
                    <button type="button" className="ghostAction" onClick={() => void addToToday(workout)}>
                      Add today
                    </button>
                  </div>
                </div>
              </article>
            ))}
      </section>

      {!loading && items.length === 0 ? (
        <section className="emptyState">
          <h2>No workouts found</h2>
          <p>Try a simpler search like “push”, “squat”, “curl”, or select only one body part.</p>
          <button type="button" onClick={() => { setQuery(""); setBodyPart(""); setEquipment(""); }}>
            Reset search
          </button>
        </section>
      ) : null}

      {nextOffset !== null ? (
        <div className="loadMore">
          <button type="button" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading..." : "Load more workouts"}
          </button>
        </div>
      ) : null}

      {metricsOpen ? (
        <div className="detailOverlay" role="dialog" aria-modal="true" aria-label="Edit BMI and calorie profile" onClick={() => setMetricsOpen(false)}>
          <article className="metricsModal" onClick={(event) => event.stopPropagation()}>
            <div className="metricsPreview">
              <p className="pageEyebrow">Your numbers</p>
              <h2>{bmi ? bmi : "—"}</h2>
              <p>BMI · {bmiInfo.label}</p>
              <div className="previewCalories"><span>Goal calories</span><strong>{macros.calories ? `${macros.calories} kcal` : "Add stats"}</strong></div>
            </div>

            <form className="metricsForm" onSubmit={saveFitnessMetrics}>
              <div className="modalTitleRow">
                <div><p className="pageEyebrow">BMI profile</p><h2>Update your stats</h2></div>
                <button type="button" className="closeModal" onClick={() => setMetricsOpen(false)}>Close</button>
              </div>

              <fieldset><legend>Sex</legend><div className="metricChips">{(["male", "female"] as const).map((option) => <button key={option} type="button" className={fitnessForm.sex === option ? "metricChip active" : "metricChip"} onClick={() => updateFitnessForm("sex", option)}>{titleCase(option)}</button>)}</div></fieldset>

              <div className="formGrid">
                <label><span>Age</span><input type="number" inputMode="numeric" value={fitnessForm.age} onChange={(event) => updateFitnessForm("age", safeNumber(event.target.value))} placeholder="24" /></label>
                <label><span>Height (cm)</span><input type="number" inputMode="decimal" value={fitnessForm.heightCm} onChange={(event) => updateFitnessForm("heightCm", safeNumber(event.target.value))} placeholder="178" /></label>
                <label><span>Weight (kg)</span><input type="number" inputMode="decimal" value={fitnessForm.weightKg} onChange={(event) => updateFitnessForm("weightKg", safeNumber(event.target.value))} placeholder="75" /></label>
              </div>

              <label><span>Activity level</span><select value={fitnessForm.activity} onChange={(event) => updateFitnessForm("activity", event.target.value as Activity)}>{Object.entries(ACTIVITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

              <fieldset><legend>Goal</legend><div className="metricChips">{(["cut", "maintain", "bulk"] as const).map((option) => <button key={option} type="button" className={fitnessForm.goal === option ? "metricChip active" : "metricChip"} onClick={() => updateFitnessForm("goal", option)}>{GOAL_LABELS[option]}</button>)}</div></fieldset>

              <div className="modalMacroGrid"><span><b>{macros.proteinG || "—"}g</b> Protein</span><span><b>{macros.carbsG || "—"}g</b> Carbs</span><span><b>{macros.fatG || "—"}g</b> Fat</span></div>

              <button type="submit" className="primaryAction wide" disabled={metricsSaving}>{metricsSaving ? "Saving..." : "Save BMI profile"}</button>
            </form>
          </article>
        </div>
      ) : null}

      {activeWorkout ? (
        <div className="detailOverlay" role="dialog" aria-modal="true" aria-label={`${activeWorkout.title} workout demo`} onClick={() => setActiveWorkout(null)}>
          <article className="detailModal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="closeModal" onClick={() => setActiveWorkout(null)}>
              Close
            </button>

            <div className="detailMedia">
              <VisualMedia workout={activeWorkout} large />
            </div>

            <div className="detailContent">
              <p className="pageEyebrow">Exercise demo</p>
              <h2>{activeWorkout.title}</h2>
              <p className="detailDescription">{activeWorkout.description || getExerciseCue(activeWorkout)}</p>

              <div className="detailFacts">
                <span><b>Body</b>{titleCase(activeWorkout.bodyPart)}</span>
                <span><b>Muscle</b>{titleCase(activeWorkout.target)}</span>
                <span><b>Equipment</b>{titleCase(activeWorkout.equipment || "body weight")}</span>
              </div>

              <div className="coachBox">
                <h3>How to use this workout</h3>
                <ol>
                  <li>Watch the visual demo first so you understand the movement path.</li>
                  <li>Start with light weight or bodyweight and keep every rep controlled.</li>
                  <li>Use 2–4 sets of 8–12 reps for strength, or 30–45 seconds for cardio/core.</li>
                </ol>
              </div>

              {stripHtml(activeWorkout.instructionsHtml) ? (
                <div className="instructionsBox">
                  <h3>Extra instructions</h3>
                  <p>{stripHtml(activeWorkout.instructionsHtml)}</p>
                </div>
              ) : null}

              <button type="button" className="primaryAction wide" onClick={() => void addToToday(activeWorkout)}>
                Add to today&apos;s planner
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <style jsx>{`
        .fitnessStudio {
          display: grid;
          gap: 22px;
          padding: clamp(18px, 2vw, 30px);
          color: var(--text);
        }

        .fitnessHero,
        .nutritionPlanner,
        .searchPanel,
        .quickStart,
        .emptyState {
          border-radius: 30px;
          background:
            radial-gradient(circle at 90% 0%, color-mix(in oklab, var(--primary) 13%, transparent), transparent 28%),
            color-mix(in oklab, var(--bg-raised) 92%, var(--bg) 8%);
          box-shadow: 0 24px 70px color-mix(in oklab, var(--bg) 70%, rgba(15, 23, 42, 0.16));
          border: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
        }

        .fitnessHero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: end;
          padding: clamp(24px, 3vw, 42px);
          overflow: hidden;
        }

        .pageEyebrow,
        .sectionLabel {
          margin: 0 0 10px;
          color: var(--primary);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .fitnessHero h1 {
          margin: 0;
          max-width: 760px;
          font-size: clamp(2.2rem, 5vw, 5.2rem);
          line-height: 0.9;
          letter-spacing: -0.08em;
          font-weight: 950;
        }

        .heroText {
          max-width: 680px;
          margin: 18px 0 0;
          color: var(--muted);
          font-size: 1rem;
          line-height: 1.75;
        }

        .heroStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(105px, 1fr));
          gap: 10px;
        }

        .heroStats div {
          min-width: 105px;
          border-radius: 22px;
          padding: 16px;
          background: color-mix(in oklab, var(--bg) 65%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .heroStats strong {
          display: block;
          font-size: 24px;
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .heroStats span {
          display: block;
          margin-top: 7px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .nutritionPlanner {
          display: grid;
          gap: 18px;
          padding: clamp(20px, 2.4vw, 30px);
        }
        .nutritionMain { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 240px); gap: 18px; align-items: stretch; }
        .nutritionHeading h2 { margin: 0; font-size: clamp(1.9rem, 3vw, 3.4rem); line-height: 0.95; letter-spacing: -0.075em; }
        .nutritionHeading p:not(.pageEyebrow) { margin: 14px 0 0; max-width: 680px; color: var(--muted); line-height: 1.7; }
        .bmiCard { display: grid; align-content: center; min-height: 190px; border-radius: 28px; padding: 22px; background: radial-gradient(circle at 100% 0%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 36%), color-mix(in oklab, var(--bg) 78%, transparent); border: 1px solid color-mix(in oklab, var(--border) 60%, transparent); }
        .bmiCard span, .nutritionStat span { color: var(--muted); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.12em; }
        .bmiCard strong { margin-top: 8px; font-size: 64px; line-height: 0.9; letter-spacing: -0.08em; }
        .bmiCard b { margin-top: 8px; color: var(--primary); }
        .bmiCard small { margin-top: 8px; color: var(--muted); line-height: 1.45; }
        .nutritionStats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        .nutritionStat { display: grid; gap: 6px; border-radius: 22px; padding: 16px; background: color-mix(in oklab, var(--bg) 72%, transparent); border: 1px solid color-mix(in oklab, var(--border) 60%, transparent); }
        .nutritionStat.highlight { background: var(--primary); color: var(--primary-contrast); border-color: transparent; }
        .nutritionStat.highlight span, .nutritionStat.highlight small { color: color-mix(in oklab, var(--primary-contrast) 78%, transparent); }
        .nutritionStat strong { font-size: 28px; line-height: 1; letter-spacing: -0.06em; }
        .nutritionStat small { color: var(--muted); font-size: 12px; font-weight: 750; }
        .nutritionActions { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .nutritionActions p { margin: 0; color: var(--muted); font-size: 0.92rem; }

        .searchPanel {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(180px, 240px) minmax(180px, 240px) minmax(180px, 220px);
          gap: 12px;
          padding: 16px;
        }

        .searchBox,
        .selectBox {
          display: grid;
          gap: 8px;
          border-radius: 20px;
          padding: 12px 14px;
          background: color-mix(in oklab, var(--bg) 78%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .searchBox span,
        .selectBox span {
          color: var(--muted);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .searchBox input,
        .selectBox select {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-weight: 750;
        }
        .plannerAction {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 5px;
  min-height: 100%;
  overflow: hidden;
  border-radius: 26px;
  padding: 16px 20px;
  text-decoration: none;
  color: var(--primary-contrast);
  background:
    radial-gradient(
      circle at 88% 18%,
      color-mix(in oklab, white 34%, transparent),
      transparent 26%
    ),
    linear-gradient(
      135deg,
      color-mix(in oklab, var(--primary) 86%, white 14%),
      color-mix(in oklab, var(--primary) 88%, black 12%)
    );
  border: 1px solid color-mix(in oklab, white 22%, transparent);
  box-shadow:
    0 20px 46px color-mix(in oklab, var(--primary) 24%, transparent),
    inset 0 1px 0 color-mix(in oklab, white 38%, transparent),
    inset 0 -18px 34px color-mix(in oklab, black 9%, transparent);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}

.plannerAction::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(
      120deg,
      transparent 0%,
      color-mix(in oklab, white 22%, transparent) 42%,
      transparent 62%
    );
  transform: translateX(-120%);
  opacity: 0;
  transition:
    transform 0.55s ease,
    opacity 0.2s ease;
}

.plannerAction::after {
  content: "→";
  position: absolute;
  right: 18px;
  bottom: 15px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: var(--primary-contrast);
  background: color-mix(in oklab, black 13%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in oklab, white 26%, transparent);
  font-size: 16px;
  font-weight: 900;
  line-height: 1;
  transition:
    transform 0.18s ease,
    background 0.18s ease;
}

.plannerAction:hover {
  transform: translateY(-2px);
  filter: brightness(1.03) saturate(1.04);
  box-shadow:
    0 26px 56px color-mix(in oklab, var(--primary) 32%, transparent),
    inset 0 1px 0 color-mix(in oklab, white 44%, transparent),
    inset 0 -18px 34px color-mix(in oklab, black 10%, transparent);
}

.plannerAction:hover::before {
  transform: translateX(120%);
  opacity: 1;
}

.plannerAction:hover::after {
  transform: translateX(3px);
  background: color-mix(in oklab, black 18%, transparent);
}

.plannerAction:active {
  transform: translateY(0);
  box-shadow:
    0 16px 34px color-mix(in oklab, var(--primary) 24%, transparent),
    inset 0 1px 0 color-mix(in oklab, white 34%, transparent);
}

.plannerAction:focus-visible {
  outline: 3px solid color-mix(in oklab, var(--primary) 30%, white 40%);
  outline-offset: 4px;
}

.plannerAction span {
  position: relative;
  z-index: 1;
  color: color-mix(in oklab, var(--primary-contrast) 72%, transparent);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.plannerAction strong {
  position: relative;
  z-index: 1;
  max-width: calc(100% - 42px);
  font-size: 1.08rem;
  line-height: 1.05;
  font-weight: 950;
  letter-spacing: -0.045em;
}
        .quickStart {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 20px;
        }

        .quickStart h2 {
          margin: 0;
          font-size: 1.45rem;
          letter-spacing: -0.055em;
        }

        .quickChips {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .quickChip,
        .primaryAction,
        .ghostAction,
        .loadMore button,
        .emptyState button,
        .closeModal {
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font: inherit;
          font-weight: 900;
          transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
        }

        .quickChip {
          padding: 10px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 72%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .quickChip:hover,
        .quickChip.active {
          transform: translateY(-1px);
          color: var(--primary-contrast);
          background: var(--primary);
        }

        .workoutGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .workoutCard {
          overflow: hidden;
          border-radius: 30px;
          background: color-mix(in oklab, var(--bg-raised) 94%, var(--bg) 6%);
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          box-shadow: 0 20px 58px color-mix(in oklab, var(--bg) 70%, rgba(15, 23, 42, 0.16));
        }

        .mediaWrap {
          position: relative;
          height: 230px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 34%),
            color-mix(in oklab, var(--bg) 82%, #111 18%);
        }

        .exerciseMedia,
        .exercisePlaceholder {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .exercisePlaceholder {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-end;
          gap: 10px;
          padding: 72px 0 0;
          text-align: center;
          color: var(--muted);
          background:
            linear-gradient(180deg, color-mix(in oklab, var(--bg) 8%, transparent) 0%, color-mix(in oklab, var(--bg) 14%, transparent) 48%, color-mix(in oklab, var(--bg) 88%, transparent) 100%);
        }

        .exercisePlaceholder span,
        .exercisePlaceholder strong,
        .exercisePlaceholder small,
        .placeholderLink {
          display: block;
        }

        .exercisePlaceholder span,
        .exercisePlaceholder strong,
        .exercisePlaceholder small {
          margin-inline: auto;
        }

        .exercisePlaceholder span {
          padding-top: 18px;
        }

        .exercisePlaceholder strong {
          max-width: 240px;
          color: var(--text);
          font-size: 1rem;
          line-height: 1.25;
          letter-spacing: -0.03em;
        }

        .exercisePlaceholder small {
          max-width: 260px;
          line-height: 1.5;
        }
        .placeholderLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          text-decoration: none;
          color: var(--primary-contrast);
          background: var(--primary);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
          margin: 0 auto 18px;
        }
        .exercisePlaceholder :global(*) {
          position: relative;
          z-index: 1;
        }

        .levelBadge {
          position: absolute;
          left: 14px;
          top: 14px;
          border-radius: 999px;
          padding: 7px 10px;
          color: var(--primary-contrast);
          background: var(--primary);
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .workoutBody {
          display: grid;
          gap: 14px;
          padding: 18px;
        }

        .workoutTitleRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .workoutTitleRow h3 {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.08;
          letter-spacing: -0.055em;
        }

        .workoutTitleRow span,
        .metaRow span {
          flex-shrink: 0;
          border-radius: 999px;
          padding: 7px 10px;
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          color: var(--primary);
          font-size: 11px;
          font-weight: 900;
        }

        .workoutBody p {
          margin: 0;
          min-height: 3.7em;
          color: var(--muted);
          line-height: 1.55;
          font-size: 0.92rem;
        }

        .metaRow {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .cardActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .primaryAction {
          padding: 11px 14px;
          color: var(--primary-contrast);
          background: var(--primary);
        }

        .ghostAction {
          padding: 11px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 72%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
        }

        .primaryAction:hover,
        .ghostAction:hover,
        .loadMore button:hover,
        .emptyState button:hover {
          transform: translateY(-1px);
        }

        .wide {
          width: 100%;
          margin-top: 6px;
        }

        .skeletonCard {
          height: 430px;
          border-radius: 30px;
          background: linear-gradient(90deg, color-mix(in oklab, var(--bg-raised) 88%, transparent), color-mix(in oklab, var(--border) 25%, transparent), color-mix(in oklab, var(--bg-raised) 88%, transparent));
          background-size: 240% 100%;
          animation: shimmer 1.3s linear infinite;
        }

        @keyframes shimmer {
          to { background-position: -240% 0; }
        }

        .errorBox,
        .toast {
          border-radius: 18px;
          padding: 14px 16px;
          color: var(--text);
          background: color-mix(in oklab, #ef4444 12%, var(--bg-raised));
          border: 1px solid color-mix(in oklab, #ef4444 26%, transparent);
        }

        .emptyState {
          padding: 36px;
          text-align: center;
        }

        .emptyState h2 {
          margin: 0 0 8px;
        }

        .emptyState p {
          margin: 0 auto 18px;
          max-width: 460px;
          color: var(--muted);
          line-height: 1.6;
        }

        .emptyState button,
        .loadMore button {
          padding: 12px 18px;
          color: var(--primary-contrast);
          background: var(--primary);
        }

        .loadMore {
          display: grid;
          place-items: center;
          padding: 8px 0 22px;
        }

        .loadMore button:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .metricsModal { width: min(980px, 100%); max-height: 92dvh; overflow: auto; display: grid; grid-template-columns: minmax(260px, 0.8fr) minmax(320px, 1.2fr); border-radius: 34px; background: var(--bg-raised); color: var(--text); box-shadow: 0 36px 120px rgba(0, 0, 0, 0.34); }
        .metricsPreview { padding: 42px; background: radial-gradient(circle at 70% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 36%), color-mix(in oklab, var(--bg) 74%, #111 8%); display: grid; align-content: center; }
        .metricsPreview h2 { margin: 0; font-size: clamp(4rem, 10vw, 7rem); line-height: 0.85; letter-spacing: -0.09em; }
        .metricsPreview p:not(.pageEyebrow) { margin: 14px 0 0; color: var(--muted); font-weight: 900; }
        .previewCalories { margin-top: 32px; display: grid; gap: 8px; border-radius: 24px; padding: 18px; background: color-mix(in oklab, var(--bg-raised) 82%, transparent); }
        .previewCalories span { color: var(--muted); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.12em; }
        .previewCalories strong { font-size: 1.6rem; letter-spacing: -0.06em; }
        .metricsForm { display: grid; gap: 18px; padding: 38px; }
        .modalTitleRow { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
        .modalTitleRow h2 { margin: 0; font-size: clamp(2rem, 4vw, 3.4rem); line-height: 0.95; letter-spacing: -0.08em; }
        .metricsForm fieldset, .metricsForm label { border: 0; padding: 0; margin: 0; display: grid; gap: 9px; }
        .metricsForm legend, .metricsForm label span { color: var(--muted); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.12em; }
        .formGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .metricsForm input, .metricsForm select { width: 100%; border: 1px solid color-mix(in oklab, var(--border) 65%, transparent); border-radius: 16px; padding: 13px 14px; background: color-mix(in oklab, var(--bg) 72%, transparent); color: var(--text); font: inherit; font-weight: 800; outline: none; }
        .metricsForm input:focus, .metricsForm select:focus { border-color: color-mix(in oklab, var(--primary) 70%, transparent); box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 14%, transparent); }
        .metricChips { display: flex; flex-wrap: wrap; gap: 8px; }
        .metricChip { border: 1px solid color-mix(in oklab, var(--border) 65%, transparent); border-radius: 999px; padding: 10px 14px; color: var(--text); background: color-mix(in oklab, var(--bg) 72%, transparent); font: inherit; font-weight: 900; cursor: pointer; }
        .metricChip.active { color: var(--primary-contrast); background: var(--primary); border-color: transparent; }
        .modalMacroGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .modalMacroGrid span { display: grid; gap: 4px; border-radius: 18px; padding: 14px; background: color-mix(in oklab, var(--bg) 72%, transparent); color: var(--muted); font-size: 12px; font-weight: 800; }
        .modalMacroGrid b { color: var(--text); font-size: 1.2rem; }

        .detailOverlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 6, 23, 0.62);
          backdrop-filter: blur(12px);
        }

        .detailModal {
          position: relative;
          width: min(1060px, 100%);
          max-height: 92dvh;
          overflow: auto;
          display: grid;
          grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.05fr);
          gap: 0;
          border-radius: 34px;
          background: var(--bg-raised);
          color: var(--text);
          box-shadow: 0 36px 120px rgba(0, 0, 0, 0.34);
        }

        .closeModal {
          position: absolute;
          right: 18px;
          top: 18px;
          z-index: 2;
          padding: 10px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 82%, transparent);
        }

        .detailMedia {
          min-height: 560px;
          padding: 24px;
          background:
            radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 38%),
            color-mix(in oklab, var(--bg) 84%, #111 16%);
        }

        .exerciseMedia.large,
        .exercisePlaceholder.large {
          border-radius: 24px;
          background: color-mix(in oklab, var(--bg) 82%, #111 18%);
        }

        .detailContent {
          display: grid;
          align-content: start;
          gap: 18px;
          padding: 42px;
        }

        .detailContent h2 {
          margin: 0;
          font-size: clamp(2rem, 4vw, 4rem);
          line-height: 0.92;
          letter-spacing: -0.08em;
        }

        .detailDescription {
          margin: 0;
          color: var(--muted);
          line-height: 1.7;
        }

        .detailFacts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .detailFacts span {
          display: grid;
          gap: 6px;
          border-radius: 18px;
          padding: 14px;
          background: color-mix(in oklab, var(--bg) 72%, transparent);
        }

        .detailFacts b {
          color: var(--muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .coachBox,
        .instructionsBox {
          border-radius: 24px;
          padding: 18px;
          background: color-mix(in oklab, var(--bg) 72%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 62%, transparent);
        }

        .coachBox h3,
        .instructionsBox h3 {
          margin: 0 0 10px;
          letter-spacing: -0.045em;
        }

        .coachBox ol {
          margin: 0;
          padding-left: 20px;
          color: var(--muted);
          line-height: 1.7;
        }

        .instructionsBox p {
          margin: 0;
          color: var(--muted);
          line-height: 1.7;
        }

        .toast {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 1300;
          background: var(--primary);
          color: var(--primary-contrast);
          border: 0;
          box-shadow: 0 18px 50px color-mix(in oklab, var(--primary) 24%, transparent);
          font-weight: 900;
        }

        @media (max-width: 1120px) {
          .fitnessHero,
          .nutritionMain,
          .searchPanel,
          .quickStart,
          .detailModal,
          .metricsModal {
            grid-template-columns: 1fr;
          }
          .heroStats { width: 100%; }
          .nutritionStats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .workoutGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .detailMedia {
            min-height: 360px;
          }
        }

        @media (max-width: 720px) {
          .fitnessStudio {
            padding: 14px;
          }
          .workoutGrid,
          .heroStats,
          .nutritionStats,
          .detailFacts,
          .formGrid,
          .modalMacroGrid {
            grid-template-columns: 1fr;
          }
          .quickStart {
            display: grid;
          }
          .quickChips {
            justify-content: flex-start;
          }
          .mediaWrap {
            height: 210px;
          }
          .detailContent {
            padding: 24px;
          }
        }
      `}</style>
    </Container>
  );
}
