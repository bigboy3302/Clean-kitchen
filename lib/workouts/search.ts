import { fetchExercises, type ExerciseDbItem } from "@/lib/workouts/exercisedb";
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

  const raw = await fetchExercises({
    search: q || undefined,
    bodyPart: bodyPart || undefined,
    target: target || undefined,
    limit: limit + 6,
    offset,
  });

  const filtered = equipment
    ? raw.filter((item) => item.equipment?.toLowerCase() === equipment.toLowerCase())
    : raw;

  const slice = filtered.slice(0, limit);
  const results: WorkoutContent[] = [];

  for (const exercise of slice) {
    let description: { text: string; html: string } | null = null;
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
      sources: ["exerciseDB", "wger"],
      tookMs: Math.round(took),
    },
  };
}
