import type { WorkoutContent } from "@/lib/workouts/types";

const FALLBACK_ID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `workout_${Math.random().toString(36).slice(2, 12)}`;
};

const clamp = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

export function sanitizeWorkoutContent(workout?: WorkoutContent | null): WorkoutContent {
  if (!workout) throw new Error("Workout payload missing");

  const title = clamp(workout.title) || "Workout";
  const description = clamp(workout.description);
  if (!description) throw new Error("Workout description required");

  const safeHtml = (workout.instructionsHtml || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "");

  const mediaType: WorkoutContent["mediaType"] =
    workout.mediaType === "mp4" ? "mp4" : workout.mediaType === "image" ? "image" : "gif";

  return {
    id: clamp(workout.id) || FALLBACK_ID(),
    title,
    mediaUrl: clamp(workout.mediaUrl),
    mediaType,
    previewUrl: clamp(workout.previewUrl) || clamp(workout.mediaUrl),
    thumbnailUrl: clamp(workout.thumbnailUrl) || clamp(workout.previewUrl) || clamp(workout.mediaUrl),
    description,
    instructionsHtml: safeHtml ? safeHtml.slice(0, 8000) : null,
    bodyPart: clamp(workout.bodyPart),
    target: clamp(workout.target),
    equipment: clamp(workout.equipment),
    source: clamp(workout.source) || "exerciseDB",
    ...(Array.isArray(workout.primaryMuscles) && workout.primaryMuscles.length > 0
      ? { primaryMuscles: workout.primaryMuscles.filter((i) => typeof i === "string" && i.trim()).map((i) => i.trim()).slice(0, 8) }
      : {}),
    ...(Array.isArray(workout.secondaryMuscles) && workout.secondaryMuscles.length > 0
      ? { secondaryMuscles: workout.secondaryMuscles.filter((i) => typeof i === "string" && i.trim()).map((i) => i.trim()).slice(0, 8) }
      : {}),
    ...(Array.isArray(workout.equipmentList) && workout.equipmentList.length > 0
      ? { equipmentList: workout.equipmentList.filter((i) => typeof i === "string" && i.trim()).map((i) => i.trim()).slice(0, 8) }
      : {}),
    externalUrl: clamp(workout.externalUrl),
  };
}
