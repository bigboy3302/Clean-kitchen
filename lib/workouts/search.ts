import { fetchExercises, type ExerciseDbItem } from "@/lib/workouts/exercisedb";
import { FALLBACK_WORKOUTS } from "@/lib/workouts/fallback";
import type { WorkoutContent, WorkoutSearchFilters, WorkoutSearchResponse } from "@/lib/workouts/types";
import { getExerciseImages } from "@/lib/workouts/exercise-images";

const perf =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance
    : { now: () => Date.now() };

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

function buildInstructionsHtml(exercise: ExerciseDbItem): string {
  if (exercise.instructions?.length) {
    const items = exercise.instructions.map((step) => `<li>${step}</li>`).join("");
    return `<ol>${items}</ol>`;
  }
  const { text } = fallbackDescription(exercise);
  return `<p>${text}</p>`;
}

function buildProxyGifUrl(rawUrl?: string | null): string | null {
  const trimmedUrl = (rawUrl || "").trim();
  if (trimmedUrl) {
    return `/api/workouts/gif?src=${encodeURIComponent(trimmedUrl)}`;
  }
  return null;
}

async function toWorkoutContent(exercise: ExerciseDbItem): Promise<WorkoutContent> {
  const instructionsHtml = buildInstructionsHtml(exercise);
  const descText = exercise.description || fallbackDescription(exercise).text;
  const directUrl = (exercise.gifUrl || "").trim() || null;
  const images = directUrl ? null : await getExerciseImages(exercise.name);
  const rawMain = directUrl ?? images?.main ?? null;
  const rawAlt = images?.alt ?? null;
  const mediaUrl = buildProxyGifUrl(rawMain);
  const altUrl = buildProxyGifUrl(rawAlt);
  const mediaType = rawMain?.endsWith(".gif") ? "gif" : "image";

  return {
    id: String(exercise.id),
    title: titleCase(exercise.name || "Exercise"),
    mediaUrl,
    mediaType,
    previewUrl: mediaUrl,
    thumbnailUrl: altUrl,
    description: descText,
    instructionsHtml,
    bodyPart: exercise.bodyPart || null,
    target: exercise.target || null,
    equipment: exercise.equipment || null,
    source: "exerciseDB",
    primaryMuscles: exercise.target ? [exercise.target] : undefined,
    secondaryMuscles: exercise.secondaryMuscles,
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
  const results: WorkoutContent[] = await Promise.all(slice.map(toWorkoutContent));

  const took = perf.now() - started;
  const nextOffset = slice.length === limit ? offset + limit : null;

  return {
    items: results,
    meta: {
      limit,
      offset,
      nextOffset,
      filters,
      sources: usedFallback ? ["fallback"] : ["exerciseDB"],
      tookMs: Math.round(took),
    },
  };
}
