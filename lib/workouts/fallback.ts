import type { ExerciseDbItem } from "@/lib/workouts/exercisedb";

export const FALLBACK_WORKOUTS: ExerciseDbItem[] = [
  {
    id: "fb-pushup",
    name: "Push-Up",
    bodyPart: "chest",
    target: "pectorals",
    equipment: "body weight",
    gifUrl: "",
  },
  {
    id: "fb-squat",
    name: "Bodyweight Squat",
    bodyPart: "upper legs",
    target: "glutes",
    equipment: "body weight",
    gifUrl: "",
  },
  {
    id: "fb-lunge",
    name: "Walking Lunge",
    bodyPart: "upper legs",
    target: "quads",
    equipment: "body weight",
    gifUrl: "",
  },
  {
    id: "fb-plank",
    name: "Plank Hold",
    bodyPart: "core",
    target: "abs",
    equipment: "body weight",
    gifUrl: "",
  },
  {
    id: "fb-burpee",
    name: "Burpee",
    bodyPart: "cardio",
    target: "cardiovascular system",
    equipment: "body weight",
    gifUrl: "",
  },
  {
    id: "fb-row",
    name: "Bent-Over Row",
    bodyPart: "back",
    target: "upper back",
    equipment: "dumbbell",
    gifUrl: "",
  },
  {
    id: "fb-press",
    name: "Standing Overhead Press",
    bodyPart: "shoulders",
    target: "delts",
    equipment: "dumbbell",
    gifUrl: "",
  },
  {
    id: "fb-deadbug",
    name: "Dead Bug",
    bodyPart: "core",
    target: "abs",
    equipment: "body weight",
    gifUrl: "",
  },
  {
    id: "fb-bike",
    name: "Stationary Bike",
    bodyPart: "cardio",
    target: "cardiovascular system",
    equipment: "machine",
    gifUrl: "",
  },
  {
    id: "fb-hipthrust",
    name: "Hip Thrust",
    bodyPart: "glutes",
    target: "glutes",
    equipment: "barbell",
    gifUrl: "",
  },
];

export function fallbackUniqueBodyParts(): string[] {
  return Array.from(new Set(FALLBACK_WORKOUTS.map((item) => item.bodyPart).filter(Boolean))).sort();
}

export function fallbackUniqueTargets(): string[] {
  return Array.from(new Set(FALLBACK_WORKOUTS.map((item) => item.target).filter(Boolean))).sort();
}

export function fallbackUniqueEquipment(): string[] {
  return Array.from(new Set(FALLBACK_WORKOUTS.map((item) => item.equipment).filter(Boolean))).sort();
}
