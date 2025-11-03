"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Goal } from "@/lib/fitness/calc";
import {
  addExerciseToToday,
  currentDayKey,
  getMetrics,
  getOrCreateDailyMeals,
  getWeekPlan,
  type DayKey,
  type ExerciseLike,
  type SuggestedMeal,
  type WeekPlan,
  type WorkoutItem,
} from "@/lib/fitness/store";
import type { WorkoutContent } from "@/lib/workouts/types";
import { recommendWorkoutsForGoal } from "@/lib/fitness/recommendations";

type PlannerItem = {
  id: string;
  name: string;
  done: boolean;
  tags: string[];
};

type UseTodayPlannerResult = {
  day: DayKey;
  goal: Goal;
  loading: boolean;
  populating: boolean;
  adding: boolean;
  error: string | null;
  items: PlannerItem[];
  recipes: SuggestedMeal[];
  suggestions: WorkoutContent[];
  refresh: () => Promise<void>;
  addToPlanner: (workout: WorkoutContent) => Promise<void>;
};

const todayKey: DayKey = currentDayKey();

const DEFAULT_GOAL: Goal = "maintain";

function tagsFromItem(item: WorkoutItem): string[] {
  const base = item.exercise || {};
  const tags = [
    base.bodyPart,
    base.target,
    base.equipment,
  ]
    .map((value) => (value ? String(value) : ""))
    .filter(Boolean);

  return Array.from(new Set(tags)).slice(0, 3);
}

function toExerciseLike(workout: WorkoutContent): ExerciseLike {
  return {
    id: workout.id,
    name: workout.title,
    bodyPart: workout.bodyPart ?? undefined,
    target: workout.target ?? undefined,
    equipment: workout.equipment ?? undefined,
    gifUrl: workout.mediaUrl ?? undefined,
    imageUrl: workout.mediaUrl ?? undefined,
    imageThumbnailUrl: workout.thumbnailUrl ?? workout.previewUrl ?? workout.mediaUrl ?? undefined,
    descriptionHtml: workout.instructionsHtml ?? undefined,
    primaryMuscles: workout.primaryMuscles,
    secondaryMuscles: workout.secondaryMuscles,
    equipmentList: workout.equipmentList,
  };
}

export function useTodayPlanner(goalPreference: Goal = DEFAULT_GOAL): UseTodayPlannerResult {
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [recipes, setRecipes] = useState<SuggestedMeal[]>([]);
  const [suggestions, setSuggestions] = useState<WorkoutContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [populating, setPopulating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPopulatedRef = useRef(false);

  const mapPlannerItems = useCallback((source: WorkoutItem[]) => {
    return source.map((item) => ({
      id: item.id,
      name: item.name,
      done: item.done,
      tags: tagsFromItem(item),
    }));
  }, []);

  const loadCore = useCallback(async () => {
    const metrics = await getMetrics().catch(() => null);
    const resolvedGoal = metrics?.goal ?? goalPreference ?? DEFAULT_GOAL;
    const plan = await getWeekPlan();
    const todaysItems = plan.days?.[todayKey]?.items ?? [];
    const todaysMeals = await getOrCreateDailyMeals(undefined, resolvedGoal, 3);

    setGoal(resolvedGoal);
    setWeekPlan(plan);
    setItems(mapPlannerItems(todaysItems));
    setRecipes(todaysMeals.slice(0, 3));

    return { items: todaysItems, resolvedGoal };
  }, [goalPreference, mapPlannerItems]);

  const computeSuggestions = useCallback(async (targetGoal: Goal, existing: WorkoutItem[]) => {
    try {
      const existingIds = new Set(
        existing.map((item) => String(item.exercise?.id ?? item.name).toLowerCase())
      );
      const recs = await recommendWorkoutsForGoal(targetGoal, Math.max(existing.length + 5, 8));
      const filtered = recs.filter((workout) => !existingIds.has(String(workout.id || workout.title).toLowerCase()));
      setSuggestions(filtered.slice(0, 6));
    } catch (err) {
      console.warn("Failed to compute suggestions", err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadCore();
      setError(null);
      await computeSuggestions(result.resolvedGoal, result.items);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Unable to load planner.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [computeSuggestions, loadCore]);

  const autopopulate = useCallback(async (targetGoal: Goal) => {
    setPopulating(true);
    try {
      const recs = await recommendWorkoutsForGoal(targetGoal, 8);
      if (!recs.length) return;
      const unique = Array.from(new Map(recs.map((workout) => [workout.id || workout.title, workout])).values());
      const initial = unique.slice(0, 5);
      for (const workout of initial) {
        await addExerciseToToday(toExerciseLike(workout));
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Unable to auto-populate workouts.";
      setError(message);
    } finally {
      setPopulating(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const base = await loadCore();
        if (cancelled) return;

        if (base.items.length === 0 && !autoPopulatedRef.current) {
          autoPopulatedRef.current = true;
          await autopopulate(base.resolvedGoal);
          if (cancelled) return;
          const refreshed = await loadCore();
          if (cancelled) return;
          await computeSuggestions(refreshed.resolvedGoal, refreshed.items);
        } else {
          await computeSuggestions(base.resolvedGoal, base.items);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error && err.message ? err.message : "Unable to load planner.";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autopopulate, computeSuggestions, loadCore]);

  const addToPlanner = useCallback(async (workout: WorkoutContent) => {
    if (!weekPlan) return;
    setAdding(true);
    try {
      await addExerciseToToday(toExerciseLike(workout), todayKey);
      await load();
      setSuggestions((prev) => prev.filter((item) => item.id !== workout.id));
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Unable to add workout.";
      setError(message);
    } finally {
      setAdding(false);
    }
  }, [load, weekPlan]);

  const stateItems = useMemo(() => items, [items]);

  return {
    day: todayKey,
    goal,
    loading,
    populating,
    adding,
    error,
    items: stateItems,
    recipes,
    suggestions,
    refresh: load,
    addToPlanner,
  };
}
