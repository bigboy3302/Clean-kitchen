'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebas1e";
import {
  getWeekPlan,
  upsertDayItem,
  toggleDone,
  removeDayItem,
  getMetrics,
  getOrCreateDailyMeals,
  getCurrentUserId,
  type WeekPlan,
  type WorkoutItem,
  type DayKey,
  type SuggestedMeal,
} from "@/lib/fitness/store";
import RecipeModal from "@/components/recipes/RecipeModal";
import { lookupMealById } from "@/lib/recipesApi";
import type { CommonRecipe } from "@/components/recipes/types";

function getMealPlanWeekKey(): string {
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  descriptionHtml: string;
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
    descriptionHtml: typeof meta.descriptionHtml === "string" ? meta.descriptionHtml : "",
    primaryMuscles,
    secondaryMuscles,
    equipmentList: equipmentList.length ? equipmentList : ["Bodyweight"],
  };
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;
type PlannerView = "workouts" | "meals";

export default function DayPlannerPage() {
  const todayKey = useMemo(() => currentDayKey(), []);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [day, setDay] = useState<DayKey>(todayKey);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [goal, setGoal] = useState<"bulk" | "cut" | "maintain">("maintain");
  const [exByItem, setExByItem] = useState<Record<string, Exercise | null>>({});
  const [recipes, setRecipes] = useState<SuggestedMeal[]>([]);
  const [mealPlanDays, setMealPlanDays] = useState<Record<string, { type?: string; calories?: string; meals?: string[] }>>({});
  const [openRecipe, setOpenRecipe] = useState<CommonRecipe | null>(null);

  // meals from the meal planner for the currently selected day
  const mealPlanItems = useMemo(() => {
    const fullName = dayNames[day]; // "Monday", "Tuesday", etc.
    return (mealPlanDays[fullName]?.meals ?? []).filter(Boolean);
  }, [mealPlanDays, day]);
  const readModeFromHash = () =>
    typeof window !== "undefined" && window.location.hash.toLowerCase() === "#meals" ? "meals" : "workouts";
  const [viewMode, setViewMode] = useState<PlannerView>(() => readModeFromHash());
  const viewingMeals = viewMode === "meals";

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setBusy(true);
        const metrics = await getMetrics().catch(() => null);
        if (!ignore && metrics?.goal) setGoal(metrics.goal);

        const freshPlan = await getWeekPlan();
        if (!ignore) setPlan(freshPlan);

        const todaysMeals = await getOrCreateDailyMeals(undefined, metrics?.goal ?? "maintain", 6);
        if (!ignore) setRecipes(todaysMeals);

        // load this week's meal plan (all days)
        try {
          const uid = await getCurrentUserId();
          if (uid) {
            const weekKey = getMealPlanWeekKey();
            const snap = await getDoc(doc(db, "mealPlans", `${uid}_${weekKey}`));
            if (snap.exists()) {
              const data = snap.data() as { days?: Record<string, { type?: string; calories?: string; meals?: string[] }> };
              if (!ignore) setMealPlanDays(data.days ?? {});
            }
          }
        } catch {
          // ignore — meal plan section will just be empty
        }
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
          const data = (await res.json()) as Exercise[] | { error?: string };
          map[item.id] = Array.isArray(data) && data.length ? data[0] : null;
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
    if (typeof window === "undefined") return;
    const sync = () => setViewMode(readModeFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMode = useCallback(
    (mode: PlannerView) => {
      setViewMode(mode);
      if (typeof window === "undefined") return;
      if (mode === "meals") {
        if (window.location.hash.toLowerCase() !== "#meals") {
          window.location.hash = "meals";
        }
      } else {
        const url = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", url);
      }
    },
    []
  );

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
    try {
      const full = await lookupMealById(meal.id);
      if (full) {
        setOpenRecipe(full);
        return;
      }
    } catch {
      // fall through to fallback shape
    }
    // Fallback if API didn't return details; shape it as CommonRecipe
    const fallback: CommonRecipe = {
      id: meal.id,
      source: "api",
      title: meal.title,
      image: meal.image || null,
      category: null,
      area: null,
      ingredients: [],
      instructions: null,
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
          {dayOrder.map((d) => {
            const isPast = dayOrder.indexOf(d) < dayOrder.indexOf(todayKey);
            return (
            <button
              key={d}
              type="button"
              className={`dayBtn ${day === d ? "active" : ""} ${isPast ? "past" : ""}`}
              onClick={() => {
                if (isPast) return;
                setDay(d);
              }}
              disabled={isPast}
            >
              {dayNames[d].slice(0, 3)}
            </button>
          );
          })}
        </nav>
        <div className="viewToggle" role="tablist" aria-label="Planner view">
          <button
            type="button"
            role="tab"
            aria-selected={!viewingMeals}
            className={`viewBtn ${!viewingMeals ? "on" : ""}`}
            onClick={() => selectMode("workouts")}
          >
            Workouts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewingMeals}
            className={`viewBtn ${viewingMeals ? "on" : ""}`}
            onClick={() => selectMode("meals")}
          >
            Meals
          </button>
        </div>
        {viewingMeals ? (
          <p className="modeHint">Showing meals for <strong>{dayNames[day]}</strong>.</p>
        ) : null}
      </section>

      {error ? <div className="alert">{error}</div> : null}

      {viewingMeals ? null : (
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
                        <p className="workDesc">
                          {stripHtml(resolved.descriptionHtml || "").slice(0, 160) ||
                            "Open this movement in the library for full cues."}
                        </p>
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
      )}

      {viewingMeals ? (
      <section className="sectionCard mealsCard" id="meals">
        <div className="sectionHead">
          <div>
            <h2 className="sectionTitle">{dayNames[day]}&apos;s meals</h2>
            <p className="muted">Your planned meals and recipe suggestions for this day.</p>
          </div>
          <Link href="/meal-plan" className="editPlanLink">Edit meal plan</Link>
        </div>

        {/* planned meals from meal planner */}
        {mealPlanItems.length > 0 ? (
          <div className="mealPlanSection">
            <div className="mealPlanHeader">
              <div className="mealPlanLabel">Your planned meals</div>
              {mealPlanDays[dayNames[day]]?.calories && (
                <div className="mealPlanCal">{mealPlanDays[dayNames[day]].calories}</div>
              )}
            </div>
            <div className="mealPlanList">
              {mealPlanItems.map((meal, i) => (
                <div key={i} className="mealPlanItem">
                  <span className="mealPlanDot" />
                  <span>{meal}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mealPlanEmpty">
            No meals planned for {dayNames[day]} yet.{" "}
            <Link href="/meal-plan" className="mealPlanLink">Go to meal planner →</Link>
          </div>
        )}

        {/* AI-suggested recipes */}
        {recipes.length > 0 && (
          <>
            <div className="recipeSuggLabel">Recipe suggestions</div>
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
                    <span className="mealLink">Open &gt;</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      ) : null}

      {openRecipe ? (
        <RecipeModal
          recipe={openRecipe}
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
        .viewToggle {
          display: inline-flex;
          gap: 8px;
          border-radius: 999px;
          padding: 4px;
          background: color-mix(in oklab, var(--bg2) 90%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          width: fit-content;
        }
        .viewBtn {
          border: 0;
          background: transparent;
          color: var(--muted);
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }
        .viewBtn.on {
          background: var(--primary);
          color: var(--primary-contrast);
          box-shadow: 0 12px 30px color-mix(in oklab, var(--primary) 30%, transparent);
        }
        .modeHint {
          margin: 4px 0 0;
          font-size: 0.85rem;
          color: var(--muted);
          font-weight: 600;
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
        .dayBtn.past {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .dayBtn:disabled {
          pointer-events: none;
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
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
        .mealTitle {
          font-weight: 700;
          color: var(--text);
          flex: 1;
        }
        .mealLink {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--primary);
          white-space: nowrap;
        }
        .editPlanLink {
          font-size: 13px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          padding: 6px 12px;
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
          border-radius: 999px;
          background: color-mix(in oklab, var(--primary) 8%, transparent);
          white-space: nowrap;
          transition: background 0.15s;
        }
        .editPlanLink:hover { background: color-mix(in oklab, var(--primary) 16%, transparent); }
        .mealPlanSection {
          border: 1px solid color-mix(in oklab, var(--primary) 28%, var(--border));
          border-radius: 16px;
          padding: 14px 16px;
          background: color-mix(in oklab, var(--primary) 6%, var(--bg));
        }
        .mealPlanHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .mealPlanLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--primary);
        }
        .mealPlanCal {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          background: color-mix(in oklab, var(--primary) 10%, var(--bg2));
          border-radius: 999px;
          padding: 3px 10px;
        }
        .mealPlanList {
          display: grid;
          gap: 8px;
        }
        .mealPlanItem {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.4;
        }
        .mealPlanDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--primary);
          flex-shrink: 0;
          margin-top: 5px;
        }
        .mealPlanEmpty {
          font-size: 14px;
          color: var(--muted);
          padding: 14px 0;
        }
        .mealPlanLink {
          color: var(--primary);
          font-weight: 700;
          text-decoration: none;
        }
        .recipeSuggLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 4px;
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
          }
          .workImg {
            max-height: 200px;
          }
        }
      `}</style>
    </Container>
  );
}
