import type { ExerciseDbItem } from "@/lib/workouts/exercisedb";

// Real ExerciseDB IDs — GIFs served from CloudFront CDN (no API key needed)
const CF = (id: string) => `https://d205bpvrqc9yn1.cloudfront.net/${id}.gif`;

export const FALLBACK_WORKOUTS: ExerciseDbItem[] = [
  { id: "0009", name: "Push-Up", bodyPart: "chest", target: "pectorals", equipment: "body weight", gifUrl: CF("0009") },
  { id: "0176", name: "Bodyweight Squat", bodyPart: "upper legs", target: "quads", equipment: "body weight", gifUrl: CF("0176") },
  { id: "0086", name: "Walking Lunge", bodyPart: "upper legs", target: "quads", equipment: "body weight", gifUrl: CF("0086") },
  { id: "0025", name: "Plank Hold", bodyPart: "waist", target: "abs", equipment: "body weight", gifUrl: CF("0025") },
  { id: "0139", name: "Burpee", bodyPart: "cardio", target: "cardiovascular system", equipment: "body weight", gifUrl: CF("0139") },
  { id: "0019", name: "Bent-Over Row", bodyPart: "back", target: "upper back", equipment: "dumbbell", gifUrl: CF("0019") },
  { id: "0065", name: "Standing Overhead Press", bodyPart: "shoulders", target: "delts", equipment: "dumbbell", gifUrl: CF("0065") },
  { id: "0030", name: "Dead Bug", bodyPart: "waist", target: "abs", equipment: "body weight", gifUrl: CF("0030") },
  { id: "0035", name: "Mountain Climber", bodyPart: "waist", target: "abs", equipment: "body weight", gifUrl: CF("0035") },
  { id: "0047", name: "Hip Thrust", bodyPart: "upper legs", target: "glutes", equipment: "barbell", gifUrl: CF("0047") },
  { id: "0011", name: "Pull-Up", bodyPart: "back", target: "lats", equipment: "body weight", gifUrl: CF("0011") },
  { id: "0051", name: "Dumbbell Bicep Curl", bodyPart: "upper arms", target: "biceps", equipment: "dumbbell", gifUrl: CF("0051") },
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
