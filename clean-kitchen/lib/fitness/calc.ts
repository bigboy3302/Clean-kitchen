// lib/fitness/calc.ts

export type Sex = "male" | "female";
export type Goal = "bulk" | "cut" | "maintain";
export type Activity =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "veryActive";

export function mifflinStJeor(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  // BMR (kcal/day)
  // male:   10W + 6.25H – 5A + 5
  // female: 10W + 6.25H – 5A – 161
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

export function activityFactor(level: Activity): number {
  switch (level) {
    case "sedentary": return 1.2;
    case "light": return 1.375;
    case "moderate": return 1.55;
    case "active": return 1.725;
    case "veryActive": return 1.9;
    default: return 1.2;
  }
}

export function tdee(bmr: number, act: Activity): number {
  return Math.round(bmr * activityFactor(act));
}

export function targetCalories(tdeeVal: number, goal: Goal): number {
  // default adjustments
  const adj =
    goal === "bulk" ? 1.15 :
    goal === "cut" ? 0.80 : 1.0;

  // guard rails: don't recommend lower than 1.2 * BMR in extreme cases
  return Math.round(tdeeVal * adj);
}

export type MacroTargets = {
  calories: number; // per day
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export function macroTargets(weightKg: number, goal: Goal, calories: number): MacroTargets {
  // protein by goal
  const proteinPerKg =
    goal === "cut" ? 2.2 :
    goal === "bulk" ? 1.6 : 1.8;

  const proteinG = Math.round(proteinPerKg * weightKg);

  // fat as % calories by goal
  const fatPct =
    goal === "cut" ? 0.25 :
    goal === "bulk" ? 0.30 : 0.30;

  const fatCal = Math.round(calories * fatPct);
  const fatG = Math.round(fatCal / 9);

  // carbs = remaining calories
  const caloriesLeft = calories - (proteinG * 4 + fatG * 9);
  const carbsG = Math.max(0, Math.round(caloriesLeft / 4));

  return { calories, proteinG, fatG, carbsG };
}

export function weekly<T extends Record<string, number>>(daily: T): T {
  const out: Record<string, number> = {};
  for (const k of Object.keys(daily)) {
    out[k] = Math.round(daily[k] * 7);
  }
  return out as T;
}

export type Suitability =
  | { status: "good"; message: string }
  | { status: "caution"; message: string }
  | { status: "notRecommended"; message: string };

export function goalSuitability(age: number, goal: Goal): Suitability {
  if (age < 14) {
    return {
      status: "notRecommended",
      message: "Intensive cutting/bulking isn’t advised at this age. Focus on healthy habits and supervised training.",
    };
  }
  if (age >= 14 && age < 18) {
    if (goal === "maintain") {
      return {
        status: "good",
        message: "Great—focus on skill, strength, and balanced nutrition during growth years.",
      };
    }
    return {
      status: "caution",
      message: "Cutting/bulking as a teen should be modest and supervised. Prioritize performance and recovery.",
    };
  }
  if (age >= 60) {
    if (goal === "bulk") {
      return {
        status: "caution",
        message: "Lean mass gain is beneficial, but increase calories gradually and prioritize resistance training.",
      };
    }
    if (goal === "cut") {
      return {
        status: "caution",
        message: "Fat loss can be helpful; keep deficits small and prioritize protein + strength to protect muscle.",
      };
    }
    return { status: "good", message: "Maintaining with strength, protein, and mobility is a solid plan." };
  }
  // 18–59
  return { status: "good", message: "This goal is reasonable. Balance training, recovery, and nutrition." };
}
