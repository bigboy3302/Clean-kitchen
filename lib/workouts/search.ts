import { fetchExercises, type ExerciseDbItem } from "@/lib/workouts/exercisedb";
import { FALLBACK_WORKOUTS } from "@/lib/workouts/fallback";
import { fetchWgerDescription } from "@/lib/workouts/wger";
import type { WorkoutContent, WorkoutSearchFilters, WorkoutSearchResponse } from "@/lib/workouts/types";

const perf = typeof performance !== "undefined" && performance?.now ? performance : { now: () => Date.now() };

const MIN_LIMIT = 6;
const MAX_LIMIT = 24;

function clampLimit(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 12;
  return Math.min(Math.max(Math.floor(n), MIN_LIMIT), MAX_LIMIT);
}

function clampOffset(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

function fallbackDescription(exercise: ExerciseDbItem): { text: string; html: string } {
  const segments: string[] = [];
  segments.push(`Start in a stable position to perform the ${exercise.name.toLowerCase()}.`);
  if (exercise.target) {
    segments.push(`Focus on engaging your ${exercise.target.toLowerCase()}.`);
  }
  if (exercise.bodyPart) {
    segments.push(`Keep the movement controlled to protect your ${exercise.bodyPart.toLowerCase()}.`);
  }
  if (exercise.equipment && exercise.equipment.toLowerCase() !== "bodyweight") {
    segments.push(`Use ${exercise.equipment.toLowerCase()} as listed.`);
  }
  const text = segments.join(" ");
  const html = `<p>${text}</p>`;
  return { text, html };
}

function toWorkoutContent(exercise: ExerciseDbItem, description: { text: string; html: string } | null): WorkoutContent {
  const desc = description ?? fallbackDescription(exercise);
  const mediaUrl = exercise.gifUrl ? `/api/workouts/gif?src=${encodeURIComponent(exercise.gifUrl)}` : null;
  return {
    id: String(exercise.id),
    title: titleCase(exercise.name || "Exercise"),
    mediaUrl,
    mediaType: mediaUrl?.endsWith(".mp4") ? "mp4" : "gif",
    previewUrl: mediaUrl,
    thumbnailUrl: mediaUrl,
    description: desc.text,
    instructionsHtml: desc.html,
    bodyPart: exercise.bodyPart || null,
    target: exercise.target || null,
    equipment: exercise.equipment || null,
    source: "exerciseDB",
    primaryMuscles: exercise.target ? [exercise.target] : undefined,
  };
}

function fallbackMatches(filters: WorkoutSearchFilters, limit: number): ExerciseDbItem[] {
  const normalizedQuery = filters.q?.toLowerCase().trim() || "";
  return FALLBACK_WORKOUTS.filter((item) => {
    if (filters.bodyPart && item.bodyPart.toLowerCase() !== filters.bodyPart.toLowerCase()) return false;
    if (filters.target && item.target.toLowerCase() !== filters.target.toLowerCase()) return false;
    if (filters.equipment && item.equipment.toLowerCase() !== filters.equipment.toLowerCase()) return false;
    if (normalizedQuery) {
      const haystack = `${item.name} ${item.bodyPart} ${item.target}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }).slice(0, Math.max(limit, 1));
}

export async function searchWorkouts(options: {
  filters: WorkoutSearchFilters;
  limit?: number;
  offset?: number;
}): Promise<WorkoutSearchResponse> {
  const started = perf.now();
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const { filters } = options;

  const { q, bodyPart, target, equipment } = filters;

  let raw: ExerciseDbItem[] = [];
  let usedFallback = false;

  try {
    raw = await fetchExercises({
      search: q || undefined,
      bodyPart: bodyPart || undefined,
      target: target || undefined,
      limit: limit + 6,
      offset,
    });
  } catch (error) {
    console.warn("Falling back to local workouts", error);
    raw = fallbackMatches(filters, limit + 6);
    usedFallback = true;
  }

  if (!raw.length) {
    raw = fallbackMatches(filters, limit + 6);
    usedFallback = true;
  }

  const filtered = equipment
    ? raw.filter((item) => item.equipment?.toLowerCase() === equipment.toLowerCase())
    : raw;

  const slice = filtered.slice(0, limit);
  const results: WorkoutContent[] = [];

  for (const exercise of slice) {
    let description: { text: string; html: string } | null = null;
    if (!usedFallback) {
      try {
        const enriched = await fetchWgerDescription(exercise.name);
        if (enriched && enriched.descriptionText) {
          description = {
            text: enriched.descriptionText,
            html: enriched.descriptionHtml,
          };
        }
      } catch (error) {
        console.warn(`Failed to fetch Wger description for ${exercise.name}:`, error);
      }
    }

    results.push(toWorkoutContent(exercise, description));
  }

  const took = perf.now() - started;
  const nextOffset = slice.length === limit ? offset + limit : null;

  return {
    items: results,
    meta: {
      limit,
      offset,
      nextOffset,
      filters,
      sources: usedFallback ? ["fallback"] : ["exerciseDB", "wger"],
      tookMs: Math.round(took),
    },
  };
}
