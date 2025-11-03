import type { Goal } from "@/lib/fitness/calc";
import type { WorkoutContent, WorkoutSearchFilters } from "@/lib/workouts/types";
import { fetchWorkoutSearch } from "@/lib/workouts/client";

const FALLBACK_FILTERS: WorkoutSearchFilters[] = [
  { q: "bodyweight" },
  { bodyPart: "back" },
  { bodyPart: "upper legs" },
  { bodyPart: "cardio" },
];

const GOAL_FILTERS: Record<Goal, WorkoutSearchFilters[]> = {
  cut: [
    { bodyPart: "cardio" },
    { q: "hiit" },
    { target: "cardiovascular system" },
  ],
  maintain: [
    { bodyPart: "back" },
    { q: "mobility" },
    { equipment: "body weight" },
  ],
  bulk: [
    { bodyPart: "chest" },
    { bodyPart: "upper legs" },
    { q: "barbell" },
  ],
};

function dedupeWorkouts(list: WorkoutContent[]): WorkoutContent[] {
  const seen = new Set<string>();
  const result: WorkoutContent[] = [];
  for (const item of list) {
    const key = item.id || item.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function fetchWithFilters(filters: WorkoutSearchFilters, limit: number): Promise<WorkoutContent[]> {
  try {
    const { items } = await fetchWorkoutSearch(filters, { limit });
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.warn("Failed to fetch workouts for filters", filters, error);
    return [];
  }
}

export async function recommendWorkoutsForGoal(goal: Goal, count: number): Promise<WorkoutContent[]> {
  const limit = Math.max(count * 2, 8);
  const filters = [...(GOAL_FILTERS[goal] ?? []), ...FALLBACK_FILTERS];
  const collected: WorkoutContent[] = [];

  for (const filter of filters) {
    const chunk = await fetchWithFilters(filter, limit);
    if (chunk.length) {
      collected.push(...chunk);
    }
    const unique = dedupeWorkouts(collected);
    if (unique.length >= count) {
      return unique.slice(0, count);
    }
  }

  const unique = dedupeWorkouts(collected);
  if (unique.length >= count) return unique.slice(0, count);

  // Final fallback: generic query
  const fallbackList = await fetchWithFilters({ q: "strength" }, limit);
  return dedupeWorkouts([...unique, ...fallbackList]).slice(0, count);
}
