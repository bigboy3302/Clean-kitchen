'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import { extractWorkouts } from "@/lib/workouts/api";
import {
  getWeekPlan,
  upsertDayItem,
  toggleDone,
  removeDayItem,
  getMetrics,
  getOrCreateDailyMeals,
  type WeekPlan,
  type WorkoutItem,
  type DayKey,
  type SuggestedMeal,
} from "@/lib/fitness/store";
import RecipeModal from "@/components/recipes/RecipeModal";
import { lookupMealById } from "@/lib/recipesApi";
import type { CommonRecipe } from "@/components/recipes/types";

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  description: string;
  descriptionHtml: string;
  instructions?: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentList: string[];
};

const dayNames: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const dayOrder: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function currentDayKey(date = new Date()): DayKey {
  const js = date.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][js] as DayKey) || "mon";
}

const cap = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);
const stripHtml = (html: string) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const mediaSrc = (ex: Exercise | null) => {
  if (!ex) return "/placeholder.png";
  if (ex.gifUrl) return `/api/workouts/gif?src=${encodeURIComponent(ex.gifUrl)}`;
  if (ex.imageThumbnailUrl) return `/api/workouts/gif?src=${encodeURIComponent(ex.imageThumbnailUrl)}`;
  if (ex.imageUrl) return `/api/workouts/gif?src=${encodeURIComponent(ex.imageUrl)}`;
  if (ex.id) return `/api/workouts/gif?id=${encodeURIComponent(ex.id)}`;
  return "/placeholder.png";
};

const exerciseFromItem = (item: WorkoutItem): Exercise | null => {
  if (!item.exercise) return null;
  const meta = item.exercise;
  const primaryMuscles = Array.isArray(meta.primaryMuscles) ? meta.primaryMuscles.map(String) : [];
  const secondaryMuscles = Array.isArray(meta.secondaryMuscles) ? meta.secondaryMuscles.map(String) : [];
  const equipmentList = Array.isArray(meta.equipmentList)
    ? meta.equipmentList.map(String)
    : meta.equipment
    ? [String(meta.equipment)]
    : [];
  const instructions = Array.isArray(meta.instructions) ? meta.instructions.map(String) : [];
  const descriptionHtml =
    typeof meta.descriptionHtml === "string" && meta.descriptionHtml.trim().length
      ? meta.descriptionHtml
      : instructions.length
      ? instructions.map((step) => `<p>${step}</p>`).join("")
      : typeof meta.description === "string" && meta.description.trim().length
      ? `<p>${meta.description.trim()}</p>`
      : "";
  const description =
    typeof meta.description === "string" && meta.description.trim().length
      ? meta.description.trim()
      : descriptionHtml
      ? stripHtml(descriptionHtml)
      : "Follow the GIF demo.";
  return {
    id: meta.id ? String(meta.id) : item.id,
    name: meta.name ? String(meta.name) : item.name,
    bodyPart: meta.bodyPart ? String(meta.bodyPart) : "Full body",
    target: meta.target ?? (primaryMuscles[0] || "General"),
    equipment: meta.equipment ? String(meta.equipment) : equipmentList[0] || "Bodyweight",
    gifUrl:
      typeof meta.gifUrl === "string"
        ? meta.gifUrl
        : typeof meta.imageUrl === "string"
        ? meta.imageUrl
        : "",
    imageUrl:
      typeof meta.imageUrl === "string"
        ? meta.imageUrl
        : typeof meta.gifUrl === "string"
        ? meta.gifUrl
        : null,
    imageThumbnailUrl:
      typeof meta.imageThumbnailUrl === "string"
        ? meta.imageThumbnailUrl
        : typeof meta.imageUrl === "string"
        ? meta.imageUrl
        : typeof meta.gifUrl === "string"
        ? meta.gifUrl
        : null,
    description,
    descriptionHtml,
    instructions,
    primaryMuscles,
    secondaryMuscles,
    equipmentList: equipmentList.length ? equipmentList : ["Bodyweight"],
  };
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export default function DayPlannerPage() {
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [day, setDay] = useState<DayKey>(() => currentDayKey());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [goal, setGoal] = useState<"bulk" | "cut" | "maintain">("maintain");
  const [exByItem, setExByItem] = useState<Record<string, Exercise | null>>({});
  const [recipes, setRecipes] = useState<SuggestedMeal[]>([]);
  const [openRecipe, setOpenRecipe] = useState<CommonRecipe | null>(null);
  const seededDaysRef = useRef<Partial<Record<DayKey, boolean>>>({});
  const mealsCacheRef = useRef<Record<string, SuggestedMeal[]>>({});

  useEffect(() => {
    seededDaysRef.current = {};
    mealsCacheRef.current = {};
  }, [plan?.weekId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setBusy(true);
        const metrics = await getMetrics().catch(() => null);
        if (!ignore && metrics?.goal) setGoal(metrics.goal);

        const freshPlan = await getWeekPlan();
        if (!ignore) setPlan(freshPlan);

      } catch (error) {
        if (!ignore) setError(getErrorMessage(error, "Unable to load today."));
      } finally {
        if (!ignore) setBusy(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const items = useMemo(() => plan?.days?.[day]?.items ?? [], [plan, day]);

  useEffect(() => {
    if (!items.length) {
      setExByItem({});
      return;
    }
    let ignore = false;
    (async () => {
      const map: Record<string, Exercise | null> = {};
      for (const item of items) {
        if (ignore) return;
        const stored = exerciseFromItem(item);
        if (stored) {
          map[item.id] = stored;
          continue;
        }
        try {
          const res = await fetch(`/api/workouts?q=${encodeURIComponent(item.name)}&limit=1`, {
            cache: "no-store",
          });
          const raw = await res.json();
          const list = extractWorkouts(raw);
          map[item.id] = list.length ? list[0] : null;
        } catch {
          map[item.id] = null;
        }
      }
      if (!ignore) setExByItem(map);
    })();
    return () => {
      ignore = true;
    };
  }, [items]);

  useEffect(() => {
    if (!plan) return;
    const dayPlan = plan.days?.[day];
    const iso = dayPlan?.date;
    if (!iso) {
      setRecipes([]);
      return;
    }
    const cacheKey = `${iso}|${goal}`;
    const cachedMeals = mealsCacheRef.current[cacheKey];
    if (cachedMeals) {
      setRecipes(cachedMeals);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meals = await getOrCreateDailyMeals(iso, goal, 3);
        if (cancelled) return;
        mealsCacheRef.current[cacheKey] = meals;
        setRecipes(meals);
      } catch (error) {
        if (!cancelled) console.warn("Failed to load meals", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, day, goal]);

  useEffect(() => {
    if (!plan || items.length > 0) {
      if (plan && items.length > 0) seededDaysRef.current[day] = true;
      return;
    }
    if (seededDaysRef.current[day]) return;
    if (!plan.weekId) return;
    seededDaysRef.current[day] = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workouts?limit=4", { cache: "no-store" });
        const raw = await res.json();
        const data = extractWorkouts(raw);
        if (!data.length || cancelled) return;
        const picks = data.slice(0, 4);
        for (const workout of picks) {
          if (cancelled) return;
          const item: WorkoutItem = {
            id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            name: workout.name,
            done: false,
            exercise: {
              id: workout.id,
              name: workout.name,
              bodyPart: workout.bodyPart,
              target: workout.target,
              equipment: workout.equipment,
              gifUrl: workout.gifUrl,
              imageUrl: workout.imageUrl ?? workout.gifUrl ?? null,
              imageThumbnailUrl: workout.imageThumbnailUrl ?? workout.imageUrl ?? workout.gifUrl ?? null,
              description: workout.description,
              descriptionHtml: workout.descriptionHtml,
              primaryMuscles: workout.primaryMuscles,
              secondaryMuscles: workout.secondaryMuscles,
              equipmentList: workout.equipmentList,
              instructions: workout.instructions,
            },
          };
          await upsertDayItem(plan.weekId, day, item);
        }
        if (!cancelled) {
          await refreshPlan(plan.weekId);
        }
      } catch (error) {
        console.warn("Failed to seed workouts for day", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, day, items.length]);

  async function refreshPlan(targetWeekId?: string) {
    try {
      const fresh = await getWeekPlan(targetWeekId);
      setPlan(fresh);
    } catch (error) {
      setError(getErrorMessage(error, "Unable to refresh plan"));
    }
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
    } catch (error) {
      setError(getErrorMessage(error, "Unable to add workout"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(id: string, done: boolean) {
    if (!plan) return;
    setBusy(true);
    try {
      await toggleDone(plan.weekId, day, id, done);
      await refreshPlan(plan.weekId);
    } catch (error) {
      setError(getErrorMessage(error, "Unable to update workout"));
    } finally {
      setBusy(false);
    }
  }

  async function removeItemNow(id: string) {
    if (!plan) return;
    setBusy(true);
    try {
      await removeDayItem(plan.weekId, day, id);
      await refreshPlan(plan.weekId);
    } catch (error) {
      setError(getErrorMessage(error, "Unable to remove workout"));
    } finally {
      setBusy(false);
    }
  }

  const dayDateIso = plan?.days?.[day]?.date;
  const dayDateLabel = useMemo(() => {
    if (!dayDateIso) return "Loading date...";
    try {
      const parsed = parseISO(dayDateIso);
      if (Number.isNaN(parsed.getTime())) return dayDateIso;
      return format(parsed, "MMM d, yyyy");
    } catch {
      return dayDateIso;
    }
  }, [dayDateIso]);

  const planEmpty = !busy && items.length === 0;
  const isLoadingPlan = busy && !plan;

  async function openMeal(meal: SuggestedMeal) {
    if (meal.ingredients?.length || meal.instructions || meal.description) {
      const recipe: CommonRecipe = {
        id: meal.id,
        source: "api",
        title: meal.title,
        image: meal.image || null,
        category: meal.category ?? null,
        area: meal.area ?? null,
        ingredients: meal.ingredients ?? [],
        instructions: meal.instructions ?? meal.description ?? null,
        author: { uid: null, name: null },
      };
      setOpenRecipe(recipe);
      return;
    }
    try {
      const full = await lookupMealById(meal.id);
      if (full) {
        setOpenRecipe(full);
        return;
      }
    } catch {
      // fall through to fallback shape
    }
    const fallback: CommonRecipe = {
      id: meal.id,
      source: "api",
      title: meal.title,
      image: meal.image || null,
      category: meal.category ?? null,
      area: meal.area ?? null,
      ingredients: [],
      instructions: meal.description ?? null,
      author: { uid: null, name: null },
    };
    setOpenRecipe(fallback);
  }

  return (
    <Container as="main" className="plannerShell">
      <PageHeader
        title="Daily planner"
        subtitle={`${dayNames[day]} - ${dayDateLabel}`}
        actions={(
          <Link className="backLink" href="/fitness">
            Back to fitness
          </Link>
        )}
      />

      <section className="sectionCard dayCard">
        <div className="daySummary">
          <span className="summaryLabel">Selected day</span>
          <div className="summaryValues">
            <span className="summaryName">{dayNames[day]}</span>
            <span className="summaryDate">{dayDateLabel}</span>
          </div>
        </div>
        <nav className="dayNav" aria-label="Select day">
          {dayOrder.map((d) => (
            <button
              key={d}
              type="button"
              className={`dayBtn ${day === d ? "active" : ""}`}
              onClick={() => setDay(d)}
            >
              {dayNames[d].slice(0, 3)}
            </button>
          ))}
        </nav>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[1.4fr_1fr]">
        <section className="sectionCard workoutCard">
        <div className="sectionHead">
          <div>
            <h2 className="sectionTitle">Workout checklist</h2>
            <p className="muted">Add movements, mark them done, or remove what you will skip.</p>
          </div>
          <span className={`badge ${goal}`}>{goal.toUpperCase()}</span>
        </div>

        <div className="addRow">
          <input
            className="inp"
            placeholder="Add workout (e.g., Push session, 5x5 squat, HIIT 20m)"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
          />
          <Button onClick={addItem} disabled={!text.trim() || busy}>
            + Add
          </Button>
        </div>

        {isLoadingPlan ? (
          <p className="muted">Loading plan...</p>
        ) : planEmpty ? (
          <div className="empty">No workouts yet. Add your first item above.</div>
        ) : (
          <ul className="planList">
            {items.map((item) => {
              const resolved = exerciseFromItem(item) || exByItem[item.id] || null;
              const chips = resolved
                ? [resolved.bodyPart, resolved.target, resolved.equipment]
                    .filter(Boolean)
                    .filter((chip, idx, arr) => arr.indexOf(chip) === idx)
                : [];
              const summary = resolved
                ? (resolved.description || stripHtml(resolved.descriptionHtml || "") || "").trim()
                : "";
              const excerpt =
                summary.length > 0
                  ? summary.length > 160
                    ? `${summary.slice(0, 157)}…`
                    : summary
                  : "Open this movement in the library for full cues.";
              return (
                <li key={item.id} className={`workItem ${item.done ? "done" : ""}`}>
                  <div className="workTop">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) => toggleItem(item.id, e.currentTarget.checked)}
                      />
                      <span>{item.name}</span>
                    </label>
                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => removeItemNow(item.id)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>

                  {resolved ? (
                    <div className="workBody">
                      <Image
                        src={mediaSrc(resolved)}
                        alt={resolved.name}
                        className="workImg"
                        width={260}
                        height={160}
                        sizes="(max-width: 768px) 60vw, 260px"
                      />
                      <div className="workMeta">
                        <div className="workName">{cap(resolved.name)}</div>
                        <p className="workDesc">{excerpt}</p>
                        <div className="chipsRow">
                          {chips.map((chip) => (
                            <span key={`${item.id}-${chip}`} className="chip">
                              {cap(chip)}
                            </span>
                          ))}
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

        <section className="sectionCard mealsCard">
        <div className="sectionHead">
          <div>
            <h2 className="sectionTitle">Today&apos;s meals</h2>
            <p className="muted">Tap a meal to preview ingredients & preparation.</p>
          </div>
        </div>

        <div className="mealGrid">
          {recipes.map((meal) => (
            <button
              key={meal.id}
              type="button"
              className="mealCard"
              onClick={() => openMeal(meal)}
            >
              <Image
                src={meal.image || "/placeholder.png"}
                alt={meal.title}
                width={72}
                height={72}
                className="mealImg"
                sizes="72px"
              />
              <div className="mealInfo">
                <div className="mealTitle">{meal.title}</div>
                <p className="mealDesc">
                  {(() => {
                    const desc = meal.description?.trim() || "";
                    const instr = meal.instructions?.split("\n").map((s) => s.trim()).find(Boolean) || "";
                    const text = desc || instr;
                    if (!text) return "Tap to see ingredients & steps.";
                    return text.length > 96 ? `${text.slice(0, 93)}…` : text;
                  })()}
                </p>
                <span className="mealLink">Open &gt;</span>
              </div>
            </button>
          ))}
          {recipes.length === 0 ? <p className="muted noMeals">No recipes saved for today yet.</p> : null}
        </div>
        </section>
      </div>

      {openRecipe ? (
        <RecipeModal
          recipe={openRecipe}
          isFavorite={false}
          onToggleFavorite={() => {}}
          onClose={() => setOpenRecipe(null)}
        />
      ) : null}

      <style jsx>{`
        .plannerShell {
          display: grid;
          gap: 24px;
          padding-block: 24px 72px;
        }
        .muted {
          color: var(--muted);
        }
        .backLink {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          font-weight: 600;
          text-decoration: none;
          transition: filter 0.18s ease, transform 0.12s ease;
        }
        .backLink:hover {
          filter: brightness(1.05);
        }
        .backLink:active {
          transform: translateY(1px);
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
        .dayCard {
          gap: 18px;
        }
        .daySummary {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px;
        }
        .summaryLabel {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .summaryValues {
          display: grid;
          gap: 4px;
        }
        .summaryName {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--text);
        }
        .summaryDate {
          color: var(--muted);
          font-weight: 600;
        }
        .dayNav {
          display: grid;
          grid-auto-flow: column;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin: 0;
        }
        .dayNav::-webkit-scrollbar {
          height: 6px;
        }
        .dayBtn {
          min-width: 72px;
          border-radius: 12px;
          padding: 8px 12px;
          font-weight: 600;
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
        }
        .dayBtn:hover {
          transform: translateY(-1px);
        }
        .dayBtn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 45%, transparent);
        }
        .dayBtn.active {
          border-color: var(--primary);
          background: color-mix(in oklab, var(--primary) 20%, var(--bg2));
          color: var(--primary-contrast);
          box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 28%, transparent);
        }
        .alert {
          border: 1px solid color-mix(in oklab, #ef4444 45%, var(--border));
          background: color-mix(in oklab, #ef4444 16%, var(--card-bg));
          color: #7f1d1d;
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 0.95rem;
        }
        .sectionHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sectionTitle {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        .badge {
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%);
          color: var(--primary-contrast);
        }
        .badge.bulk {
          background: color-mix(in oklab, var(--primary) 26%, var(--bg2));
        }
        .badge.cut {
          background: color-mix(in oklab, #ef4444 26%, var(--bg2));
          color: #fff;
        }
        .badge.maintain {
          background: color-mix(in oklab, #0ea5e9 26%, var(--bg2));
          color: #0b1220;
        }
        .addRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .inp {
          flex: 1;
          min-width: 220px;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px 14px;
          background: var(--bg2);
          color: var(--text);
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .inp:focus {
          border-color: color-mix(in oklab, var(--primary) 35%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 45%, transparent);
          background: var(--bg);
          outline: none;
        }
        .planList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 14px;
        }
        .workItem {
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 16px;
          background: color-mix(in oklab, var(--bg2) 95%, transparent);
          display: grid;
          gap: 14px;
          transition: border-color 0.18s ease, background 0.18s ease;
        }
        .workItem.done {
          opacity: 0.65;
        }
        .workTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .check {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          color: var(--text);
        }
        .check input {
          width: 18px;
          height: 18px;
          border: 1px solid var(--border);
          border-radius: 6px;
        }
        .ghostBtn {
          border-radius: 999px;
          padding: 6px 14px;
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          color: color-mix(in oklab, var(--primary) 45%, var(--text));
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .ghostBtn:hover {
          background: color-mix(in oklab, var(--primary) 18%, var(--bg2));
          border-color: var(--primary);
        }
        .ghostBtn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .workBody {
          display: grid;
          grid-template-columns: minmax(0, 130px) 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 480px) {
          .workTop {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .ghostBtn {
            width: 100%;
            text-align: center;
          }
        }
        .workImg {
          width: 100%;
          border-radius: 14px;
          object-fit: cover;
          background: var(--bg);
          border: 1px solid var(--border);
          max-height: 160px;
        }
        .workMeta {
          display: grid;
          gap: 10px;
        }
        .workName {
          font-weight: 800;
          font-size: 1rem;
          color: var(--text);
        }
        .workDesc {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .chipsRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          font-size: 0.7rem;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
          background: color-mix(in oklab, var(--primary) 12%, var(--bg2));
          color: color-mix(in oklab, var(--primary) 45%, var(--text));
        }
        .empty {
          border: 1px dashed var(--border);
          border-radius: 16px;
          padding: 18px;
          text-align: center;
          background: color-mix(in oklab, var(--bg2) 88%, transparent);
          font-weight: 600;
          color: var(--muted);
        }
        .mealGrid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .mealCard {
          display: flex;
          align-items: center;
          gap: 14px;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 12px;
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.2s ease, border-color 0.18s ease;
          text-align: left;
        }
        .mealCard:hover {
          transform: translateY(-2px);
          border-color: var(--primary);
          box-shadow: 0 14px 32px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        .mealImg {
          width: 72px;
          height: 72px;
          border-radius: 14px;
          object-fit: cover;
          border: 1px solid var(--border);
          flex-shrink: 0;
        }
        .mealInfo {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          width: 100%;
        }
        .mealTitle {
          font-weight: 700;
          color: var(--text);
          flex: 1;
        }
        .mealDesc {
          margin: 0;
          color: var(--muted);
          font-size: 0.85rem;
          line-height: 1.35;
          max-width: 28ch;
        }
        .mealLink {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--primary);
          white-space: nowrap;
          align-self: flex-start;
        }
        .noMeals {
          grid-column: 1 / -1;
          text-align: center;
        }
        @media (max-width: 768px) {
          .mealGrid {
            grid-template-columns: 1fr;
          }
          .mealCard {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .mealImg {
            width: 100%;
            height: auto;
            aspect-ratio: 4 / 3;
            border-radius: 14px;
          }
          .mealInfo {
            gap: 8px;
          }
          .mealDesc {
            max-width: none;
          }
          .mealLink {
            align-self: flex-start;
          }
        }
        @media (max-width: 720px) {
          .plannerShell {
            gap: 20px;
            padding-block: 20px 60px;
          }
          .sectionCard {
            padding: 18px 16px;
          }
          .addRow {
            flex-direction: column;
          }
          .inp {
            min-width: unset;
            width: 100%;
          }
          .workBody {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .workImg {
            max-height: none;
          }
        }
        @media (max-width: 480px) {
          .workBody {
            gap: 10px;
          }
          .workImg {
            border-radius: 16px;
          }
          .workDesc {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </Container>
  );
}
