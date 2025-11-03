// lib/fitness/store.ts
/* ======================================================================
   Types
====================================================================== */
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkoutItem = {
  id: string;
  name: string;
  done: boolean;
  /** Optional embedded exercise metadata for rich rendering in /fitness/day */
  exercise?: {
    id?: string | number;
    name?: string;
    bodyPart?: string;
    target?: string;
    equipment?: string;
    imageUrl?: string | null;
    imageThumbnailUrl?: string | null;
    gifUrl?: string | null;
    descriptionHtml?: string;
    description?: string;
    primaryMuscles?: (string | number)[];
    secondaryMuscles?: (string | number)[];
    equipmentList?: (string | number)[];
    instructions?: (string | number)[];
  };
};

export type DayPlan = {
  date: string;          // ISO yyyy-mm-dd
  items: WorkoutItem[];  // checklist items
};

export type WeekPlan = {
  weekId: string;                    // e.g. "2025-W41"
  startIsoDate: string;              // Monday yyyy-mm-dd
  days: Record<DayKey, DayPlan>;
};

export type Metrics = {
  sex?: "male" | "female";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  activity?: "sedentary" | "light" | "moderate" | "active" | "veryActive";
  goal?: "cut" | "maintain" | "bulk";
};

import type { Ingredient } from "@/lib/recipesApi";

export type SuggestedMeal = {
  id: string;
  title: string;
  image?: string | null;
  description?: string | null;
  instructions?: string | null;
  ingredients?: Ingredient[];
  category?: string | null;
  area?: string | null;
};

/** Minimal shape we accept when adding from the movement library */
export type ExerciseLike = {
  id?: string | number;
  name: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  gifUrl?: string | null;
  imageUrl?: string | null;
  imageThumbnailUrl?: string | null;
  descriptionHtml?: string;
  description?: string;
  primaryMuscles?: (string | number)[];
  secondaryMuscles?: (string | number)[];
  equipmentList?: (string | number)[];
  instructions?: (string | number)[];
};

/* ======================================================================
   Safe storage (SSR friendly)
====================================================================== */
const LS_PREFIX = "ck:v1:";
const mem = new Map<string, string>();

function hasLS() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}
function lsGet(k: string): string | null {
  return hasLS() ? window.localStorage.getItem(k) : mem.get(k) ?? null;
}
function lsSet(k: string, v: string) {
  if (hasLS()) window.localStorage.setItem(k, v);
  else mem.set(k, v);
}
const key = (suffix: string) => `${LS_PREFIX}${suffix}`;

function safeParse<T>(json: string | null): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

/* ======================================================================
   Dates & week helpers
====================================================================== */
function fmtDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getMonday(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function isoWeekId(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
export function currentDayKey(date = new Date()): DayKey {
  const js = date.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][js] as DayKey) || "mon";
}
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/* ======================================================================
   Metrics (client)
====================================================================== */
export async function getMetrics(): Promise<Metrics | null> {
   return safeParse<Metrics>(lsGet(key("metrics")));
}


export async function saveMetrics(m: Metrics) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) if (v !== undefined) clean[k] = v;
  lsSet(key("metrics"), JSON.stringify(clean));
}

/* ======================================================================
   Week plan (client)
====================================================================== */
function newEmptyWeekPlan(forDate = new Date()): WeekPlan {
  const monday = getMonday(forDate);
  const weekId = isoWeekId(forDate);
  const startIso = fmtDate(monday);
  const days: Record<DayKey, DayPlan> = {
    mon: { date: fmtDate(addDays(monday, 0)), items: [] },
    tue: { date: fmtDate(addDays(monday, 1)), items: [] },
    wed: { date: fmtDate(addDays(monday, 2)), items: [] },
    thu: { date: fmtDate(addDays(monday, 3)), items: [] },
    fri: { date: fmtDate(addDays(monday, 4)), items: [] },
    sat: { date: fmtDate(addDays(monday, 5)), items: [] },
    sun: { date: fmtDate(addDays(monday, 6)), items: [] },
  };
  return { weekId, startIsoDate: startIso, days };
}
const planKey = (weekId: string) => key(`plan:${weekId}`);

type ApiWorkoutSeed = {
  id?: string;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  gifUrl?: string;
  description?: string;
  descriptionHtml?: string;
  imageUrl?: string | null;
  imageThumbnailUrl?: string | null;
  primaryMuscles?: (string | number)[];
  secondaryMuscles?: (string | number)[];
  equipmentList?: (string | number)[];
  instructions?: (string | number)[];
};

function toStringArray(value: (string | number)[] | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (typeof entry === "number") return String(entry);
      return "";
    })
    .filter(Boolean);
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedWeekPlanIfEmpty(plan: WeekPlan): Promise<WeekPlan> {
  if (typeof window === "undefined") return plan;
  const hasItems = DAY_KEYS.some((day) => plan.days?.[day]?.items?.length);
  if (hasItems) return plan;

  try {
    const res = await fetch("/api/workouts?limit=28", { cache: "no-store" });
    if (!res.ok) return plan;
    const json = (await res.json()) as ApiWorkoutSeed[] | null;
    if (!Array.isArray(json) || json.length === 0) return plan;

    const next: WeekPlan = {
      ...plan,
      days: { ...plan.days },
    };

    const perDay = Math.max(3, Math.min(4, Math.ceil(json.length / DAY_KEYS.length)));
    let cursor = 0;

    for (const day of DAY_KEYS) {
      const baseDay = next.days[day] || { date: fmtDate(addDays(new Date(next.startIsoDate), DAY_KEYS.indexOf(day))), items: [] };
      const items: WorkoutItem[] = [];
      for (let i = 0; i < perDay; i += 1) {
        const workout = json[cursor % json.length];
        cursor += 1;
        if (!workout) continue;
        const name = (workout.name || "Workout").toString();
        const bodyPart = (workout.bodyPart || workout.target || "full body").toString();
        const target = (workout.target || workout.bodyPart || "full body").toString();
        const equipment = (workout.equipment || "body weight").toString();
        const gifUrl = typeof workout.gifUrl === "string" ? workout.gifUrl : "";
        const primaryMuscles = toStringArray(workout.primaryMuscles);
        const secondaryMuscles = toStringArray(workout.secondaryMuscles);
        const equipmentList = toStringArray(workout.equipmentList);
        if (!equipmentList.length && equipment) equipmentList.push(equipment);
        const instructions = toStringArray(workout.instructions);
        const description =
          (typeof workout.description === "string" && workout.description.trim()) ||
          (instructions.length ? instructions.join(" ") : "Follow the GIF demo.");
        const descriptionHtml =
          (typeof workout.descriptionHtml === "string" && workout.descriptionHtml.trim()) ||
          (instructions.length ? instructions.map((step) => `<p>${step}</p>`).join("") : `<p>${description}</p>`);

        items.push({
          id: randomId(),
          name,
          done: false,
          exercise: {
            id: workout.id ?? randomId(),
            name,
            bodyPart,
            target,
            equipment,
            imageUrl: (typeof workout.imageUrl === "string" && workout.imageUrl) || gifUrl || null,
            imageThumbnailUrl:
              (typeof workout.imageThumbnailUrl === "string" && workout.imageThumbnailUrl) ||
              (typeof workout.imageUrl === "string" && workout.imageUrl) ||
              gifUrl ||
              null,
            gifUrl: gifUrl || null,
            description,
            descriptionHtml,
            primaryMuscles: primaryMuscles.length ? primaryMuscles : target ? [target] : [],
            secondaryMuscles,
            equipmentList,
            instructions,
          },
        });
      }
      next.days[day] = { ...baseDay, items };
    }

    lsSet(planKey(next.weekId), JSON.stringify(next));
    return next;
  } catch (error) {
    console.warn("seedWeekPlanIfEmpty failed", error);
    return plan;
  }
}

export async function getWeekPlan(targetWeekId?: string): Promise<WeekPlan> {
  const weekId = targetWeekId || isoWeekId(new Date());
  const cached = safeParse<WeekPlan>(lsGet(planKey(weekId)));
  if (cached?.days) {
    // Defensive repair to avoid undefined .items / push errors
    let mutated = false;
    for (const d of DAY_KEYS) {
      if (!cached.days[d]) {
        cached.days[d] = {
          date: fmtDate(addDays(new Date(cached.startIsoDate), DAY_KEYS.indexOf(d))),
          items: [],
        };
        mutated = true;
      } else if (!Array.isArray(cached.days[d].items)) {
        cached.days[d].items = [];
        mutated = true;
      }
    }
    if (mutated) lsSet(planKey(weekId), JSON.stringify(cached));
    return seedWeekPlanIfEmpty(cached);
  }
  const fresh = newEmptyWeekPlan(new Date());
  lsSet(planKey(fresh.weekId), JSON.stringify(fresh));
  return seedWeekPlanIfEmpty(fresh);
}

export async function upsertDayItem(weekId: string, day: DayKey, item: WorkoutItem): Promise<void> {
  const plan = await getWeekPlan(weekId);
  const dayPlan = plan.days[day] || { date: fmtDate(new Date()), items: [] };
  if (!Array.isArray(dayPlan.items)) dayPlan.items = [];
  const idx = dayPlan.items.findIndex((x) => x.id === item.id);
  if (idx >= 0) dayPlan.items[idx] = { ...dayPlan.items[idx], ...item };
  else dayPlan.items.push(item);
  plan.days[day] = dayPlan;
  lsSet(planKey(plan.weekId), JSON.stringify(plan));
}

export async function toggleDone(weekId: string, day: DayKey, id: string, done: boolean): Promise<void> {
  const plan = await getWeekPlan(weekId);
  const dp = plan.days[day];
  if (!dp?.items) return;
  const idx = dp.items.findIndex((x) => x.id === id);
  if (idx >= 0) {
    dp.items[idx] = { ...dp.items[idx], done: !!done };
    lsSet(planKey(plan.weekId), JSON.stringify(plan));
  }
}

export async function removeDayItem(weekId: string, day: DayKey, id: string): Promise<void> {
  const plan = await getWeekPlan(weekId);
  const dp = plan.days[day];
  if (!dp?.items) return;
  dp.items = dp.items.filter((x) => x.id !== id);
  plan.days[day] = dp;
  lsSet(planKey(plan.weekId), JSON.stringify(plan));
}

/* ======================================================================
   â€œAdd to Todayâ€ helper (for the library grid)
====================================================================== */
export async function addExerciseToToday(ex: ExerciseLike, day?: DayKey) {
  const now = new Date();
  const wk = await getWeekPlan(); // current week
  const targetDay: DayKey = day || currentDayKey(now);
  const name = ex.name?.trim() || "Exercise";

  const item: WorkoutItem = {
    id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    done: false,
    exercise: {
      id: ex.id,
      name: ex.name,
      bodyPart: ex.bodyPart,
      target: ex.target,
      equipment: ex.equipment,
      imageUrl: ex.imageUrl ?? ex.gifUrl ?? null,
      imageThumbnailUrl: ex.imageThumbnailUrl ?? ex.imageUrl ?? ex.gifUrl ?? null,
      gifUrl: ex.gifUrl ?? null,
      descriptionHtml: ex.descriptionHtml,
      description: ex.description,
      primaryMuscles: ex.primaryMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      equipmentList: ex.equipmentList,
      instructions: ex.instructions,
    },
  };

  await upsertDayItem(wk.weekId, targetDay, item);
  return { weekId: wk.weekId, day: targetDay, item };
}

/* ======================================================================
   Daily meals (client)
====================================================================== */
const FALLBACK_MEALS: SuggestedMeal[] = [
  {
    id: "52772",
    title: "Teriyaki Chicken Casserole",
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    description: "Oven-baked chicken casserole coated in a sweet teriyaki glaze with tender vegetables and rice.",
    instructions:
      "Preheat oven to 180°C. Combine cooked rice, steamed vegetables, shredded chicken, and teriyaki sauce in a baking dish. Top with sesame seeds and bake 15 minutes until bubbly.",
    ingredients: [
      { name: "Cooked rice", measure: "3 cups" },
      { name: "Chicken breast", measure: "2 cups, shredded" },
      { name: "Mixed vegetables", measure: "2 cups" },
      { name: "Teriyaki sauce", measure: "1 cup" },
      { name: "Sesame seeds", measure: "1 tbsp" },
    ],
    category: "Dinner",
    area: "Japanese",
  },
  {
    id: "52804",
    title: "Poutine",
    image: "https://www.themealdb.com/images/media/meals/uuyrrx1487327597.jpg",
    description: "Crispy fries covered in rich gravy and squeaky cheese curds — the ultimate Canadian comfort food.",
    instructions:
      "Bake French fries until crisp. Warm beef gravy on the stove. Assemble fries on a platter, scatter cheese curds, and ladle hot gravy over the top. Serve immediately.",
    ingredients: [
      { name: "French fries", measure: "500 g" },
      { name: "Cheese curds", measure: "200 g" },
      { name: "Beef gravy", measure: "400 ml" },
    ],
    category: "Snack",
    area: "Canadian",
  },
  {
    id: "52977",
    title: "Corba",
    image: "https://www.themealdb.com/images/media/meals/58oia61564916529.jpg",
    description: "A warming Turkish red lentil soup with tomato, mint, and a hint of spice.",
    instructions:
      "Sauté onion, garlic, and carrot in olive oil. Stir in red lentils, tomato paste, cumin, and paprika. Pour in stock and simmer 20 minutes. Blend until smooth and finish with lemon juice and dried mint.",
    ingredients: [
      { name: "Red lentils", measure: "1 cup" },
      { name: "Onion", measure: "1, diced" },
      { name: "Tomato paste", measure: "2 tbsp" },
      { name: "Vegetable stock", measure: "4 cups" },
      { name: "Dried mint", measure: "1 tsp" },
    ],
    category: "Soup",
    area: "Turkish",
  },
];

function mealsKey(dateIso: string, goal: "cut" | "maintain" | "bulk") {
  return key(`meals:${dateIso}:${goal}`);
}
function todayIso() { return fmtDate(new Date()); }
const MEALS_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  if (hash === 0) hash = 1;
  let state = hash >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleBySeed<T>(list: readonly T[], seed: string): T[] {
  const random = seededRandom(seed);
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function getOrCreateDailyMeals(
  dateIso?: string,
  _goal: "cut" | "maintain" | "bulk" = "maintain",
  count = 3
) {
  const day = dateIso || todayIso();
  const goal = _goal || "maintain";
  const safeCount = Math.min(Math.max(count, 1), 6);
  const cacheId = mealsKey(day, goal);

  const cached = safeParse<{ items?: SuggestedMeal[]; expiresAt?: number }>(lsGet(cacheId));
  if (
    cached &&
    Array.isArray(cached.items) &&
    cached.items.length >= safeCount &&
    typeof cached.expiresAt === "number" &&
    cached.expiresAt > Date.now()
  ) {
    return cached.items.slice(0, safeCount);
  }

  try {
    const params = new URLSearchParams({ count: String(safeCount), goal, date: day });
    const res = await fetch(`/api/recipes/random?${params.toString()}`, { cache: "no-store" });
    if (res.ok) {
      const list = (await res.json()) as Array<{
        id?: string | number;
        title?: string;
        image?: string | null;
        description?: string | null;
        instructions?: string | null;
        ingredients?: Ingredient[];
        category?: string | null;
        area?: string | null;
      }>;
      if (Array.isArray(list) && list.length) {
        const shaped: SuggestedMeal[] = list.map((item, idx) => ({
          id: item?.id ? String(item.id) : `meal-${day}-${goal}-${idx}`,
          title: item?.title ?? "Recipe",
          image: item?.image ?? null,
          description: item?.description ?? null,
          instructions: item?.instructions ?? null,
          ingredients: Array.isArray(item?.ingredients) ? item.ingredients : [],
          category: item?.category ?? null,
          area: item?.area ?? null,
        }));
        const payload = { items: shaped, expiresAt: Date.now() + MEALS_TTL_MS };
        lsSet(cacheId, JSON.stringify(payload));
        return shaped.slice(0, safeCount);
      }
    }
  } catch {
    // ignore — use fallback
  }

  const seededFallback = shuffleBySeed(FALLBACK_MEALS, `${day}:${goal}`);
  const fallbackPayload = { items: seededFallback, expiresAt: Date.now() + MEALS_TTL_MS };
  lsSet(cacheId, JSON.stringify(fallbackPayload));
  return seededFallback.slice(0, safeCount);
}

/* ======================================================================
   Auth helpers for Weekly page (minimal)
====================================================================== */
export async function getCurrentUserId(): Promise<string | null> {
  // For now, deterministic anon id so per-user storage stays distinct.
  const anonKey = key("anonUid");
  const existing = lsGet(anonKey);
  if (existing) return existing;
  const uid = `anon_${Math.random().toString(36).slice(2, 10)}`;
  lsSet(anonKey, uid);
  return uid;
}

/** Ensures a user is signed in during runtime; throws if not. */
export async function requireSignedIn(): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("AUTH_REQUIRED");
  return uid;
}
