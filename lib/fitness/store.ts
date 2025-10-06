// lib/fitness/store.ts
"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/* =========================
   Auth helpers (client)
   ========================= */

export async function requireSignedIn(): Promise<{ uid: string }> {
  const existing = auth.currentUser;
  if (existing) return { uid: existing.uid };

  // Wait once for auth state to resolve
  const u = await new Promise<User | null>((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
  if (!u) throw new Error("Not signed in");
  return { uid: u.uid };
}

/* =========================
   User metrics (profile)
   ========================= */

export type Metrics = {
  sex?: "male" | "female";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  activity?: "sedentary" | "light" | "moderate" | "active" | "veryActive";
  goal?: "bulk" | "cut" | "maintain";
  updatedAt?: any;
};

export async function getMetrics(): Promise<Metrics | null> {
  const { uid } = await requireSignedIn();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const d = snap.data() as any;

  // Support possible older names (height/weight) if they existed
  const heightCm = (d.heightCm ?? d.height) as number | undefined;
  const weightKg = (d.weightKg ?? d.weight) as number | undefined;

  const m: Metrics = {
    sex: d.sex ?? "male",
    age: d.age ?? 24,
    heightCm,
    weightKg,
    activity: d.activity ?? "moderate",
    goal: d.goal ?? "maintain",
    updatedAt: d.updatedAt,
  };
  return m;
}

export async function saveMetrics(payload: Metrics): Promise<void> {
  const { uid } = await requireSignedIn();
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* =========================
   Week id helpers (ISO week)
   ========================= */

function toISOWeek(date = new Date()): { year: number; week: number; dates: string[] } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() || 7)));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);

  // Build Mon..Sun yyyy-mm-dd for that ISO week
  const dates: string[] = [];
  const dayOne = new Date(d);
  dayOne.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1)); // Monday of the week
  for (let i = 0; i < 7; i++) {
    const dt = new Date(dayOne);
    dt.setUTCDate(dayOne.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }

  return { year: d.getUTCFullYear(), week, dates };
}

export function weekIdFromDate(date = new Date()): string {
  const { year, week } = toISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Alias used elsewhere
export const isoWeekKey = weekIdFromDate;

/* =========================
   Weekly planner (Firestore)
   ========================= */

export type WorkoutItem = {
  id: string;
  name: string;
  done: boolean;
};

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const dayKeys: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type WeekPlan = {
  weekId: string;
  uid: string;
  days: Record<
    DayKey,
    {
      date: string;       // yyyy-mm-dd
      items: WorkoutItem[];
    }
  >;
  updatedAt?: any;
};

function emptyWeek(weekId: string, uid: string): WeekPlan {
  // Generate accurate dates for the ISO week
  const [yearStr, wStr] = weekId.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);

  // Find Monday of ISO week 1: Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1..7
  const mondayOfW1 = new Date(jan4);
  mondayOfW1.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));

  const monday = new Date(mondayOfW1);
  monday.setUTCDate(mondayOfW1.getUTCDate() + (week - 1) * 7);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setUTCDate(monday.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }

  const days = dayKeys.reduce((acc, n, i) => {
    acc[n] = { date: dates[i], items: [] as WorkoutItem[] };
    return acc;
  }, {} as WeekPlan["days"]);

  return { weekId, uid, days };
}

function weekDocRef(uid: string, weekId: string) {
  return doc(db, "users", uid, "planner", weekId);
}

export async function getWeekPlan(weekId?: string): Promise<WeekPlan> {
  const { uid } = await requireSignedIn();
  const wk = weekId ?? weekIdFromDate();
  const ref = weekDocRef(uid, wk);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as any;

    // Base shape
    const coerce = emptyWeek(wk, uid);
    const out: WeekPlan = {
      weekId: wk,
      uid,
      days: coerce.days,
      updatedAt: data.updatedAt,
    };

    // Merge stored days/items if present
    if (data?.days && typeof data.days === "object") {
      (Object.keys(coerce.days) as DayKey[]).forEach((k) => {
        const d = data.days[k];
        if (d && typeof d === "object") {
          out.days[k] = {
            date: typeof d.date === "string" ? d.date : coerce.days[k].date,
            items: Array.isArray(d.items)
              ? d.items
                  .filter((x: any) => x && typeof x.id === "string" && typeof x.name === "string")
                  .map((x: any) => ({ id: String(x.id), name: String(x.name), done: !!x.done }))
              : [],
          };
        }
      });
    }

    return out;
  }

  // Create a fresh week if missing
  const init = emptyWeek(wk, uid);
  await setDoc(ref, { ...init, updatedAt: serverTimestamp() }, { merge: true });
  return init;
}

export async function upsertDayItem(
  weekId: string,
  day: DayKey,
  item: WorkoutItem
): Promise<void> {
  const { uid } = await requireSignedIn();
  const ref = weekDocRef(uid, weekId);
  const snap = await getDoc(ref);
  const base = snap.exists() ? (snap.data() as any) : emptyWeek(weekId, uid);

  const days = { ...(base.days || {}) };
  const dayData = days[day] || { date: emptyWeek(weekId, uid).days[day].date, items: [] as WorkoutItem[] };

  // Upsert by id
  const idx = (dayData.items as WorkoutItem[]).findIndex((x) => x.id === item.id);
  if (idx >= 0) dayData.items[idx] = item;
  else dayData.items.push(item);

  days[day] = dayData;

  await setDoc(
    ref,
    { weekId, uid, days, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function toggleDone(
  weekId: string,
  day: DayKey,
  id: string,
  done: boolean
): Promise<void> {
  const { uid } = await requireSignedIn();
  const ref = weekDocRef(uid, weekId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as any;
  const days = { ...(data.days || {}) };
  const d = days[day];
  if (!d || !Array.isArray(d.items)) return;

  const items: WorkoutItem[] = d.items.map((x: any) =>
    x && x.id === id ? { id: String(x.id), name: String(x.name), done } : x
  );

  days[day] = { date: d.date, items };
  await setDoc(ref, { days, updatedAt: serverTimestamp() }, { merge: true });
}

/* =========================
   Meal suggestions (API)
   ========================= */

export type SuggestedMeal = { id: string; title: string; image?: string | null };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchMealsByIngredients(terms: string[], limit = 8) {
  const qs = new URLSearchParams({
    ingredients: terms.join(","),
    limit: String(limit),
    mode: "union",
  });
  const res = await fetch(`/api/recipes?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const list = (data?.recipes || []) as { id: string; title: string; image: string | null }[];
  return list.map((r) => ({ id: r.id, title: r.title, image: r.image })) as SuggestedMeal[];
}

/** Single flat list (compat) */
export async function suggestMeals(
  goal: "bulk" | "cut" | "maintain",
  limit = 6
): Promise<SuggestedMeal[]> {
  const seeds =
    goal === "bulk"
      ? ["chicken", "beef", "pasta", "rice", "potato"]
      : goal === "cut"
      ? ["chicken", "fish", "egg white", "yogurt", "salad"]
      : ["chicken", "rice", "egg", "vegetable", "yogurt"];

  const list = await fetchMealsByIngredients(seeds, Math.max(6, limit * 2));
  return shuffle(list).slice(0, limit);
}

/** Different meals per day (3 per day by default) */
export async function suggestMealsForWeek(
  goal: "bulk" | "cut" | "maintain",
  perDay = 3
): Promise<Record<DayKey, SuggestedMeal[]>> {
  // Slightly different seed themes per day
  const seedMap: Record<DayKey, string[]> =
    goal === "bulk"
      ? {
          mon: ["chicken", "rice", "pasta"],
          tue: ["beef", "potato", "pasta"],
          wed: ["pork", "rice", "egg"],
          thu: ["salmon", "rice", "avocado"],
          fri: ["chicken", "bagel", "yogurt"],
          sat: ["beef", "pasta", "cheese"],
          sun: ["turkey", "rice", "oats"],
        }
      : goal === "cut"
      ? {
          mon: ["chicken", "salad", "yogurt"],
          tue: ["fish", "zucchini", "rice cake"],
          wed: ["egg white", "spinach", "tomato"],
          thu: ["turkey", "cucumber", "wrap"],
          fri: ["white fish", "greens", "berries"],
          sat: ["chicken", "cauliflower", "yogurt"],
          sun: ["shrimp", "salad", "egg white"],
        }
      : {
          mon: ["chicken", "rice", "veggies"],
          tue: ["beef", "quinoa", "pepper"],
          wed: ["eggs", "oats", "banana"],
          thu: ["salmon", "potato", "greens"],
          fri: ["turkey", "rice", "beans"],
          sat: ["tuna", "pasta", "olive"],
          sun: ["tofu", "stir fry", "rice"],
        };

  const out: Record<DayKey, SuggestedMeal[]> = {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  };

  await Promise.all(
    dayKeys.map(async (k) => {
      const pool = await fetchMealsByIngredients(seedMap[k], 16);
      const chosen = shuffle(pool).slice(0, perDay);
      out[k] = chosen;
    })
  );

  return out;
}

/* =========================
   Workout templates per goal
   ========================= */

export type WorkoutTemplateItem = WorkoutItem & { note?: string };
export type WeekWorkoutTemplate = Record<DayKey, WorkoutTemplateItem[]>;

/** Goal-based weekly template, editable by the user */
export function suggestWorkoutsForWeek(
  goal: "bulk" | "cut" | "maintain"
): WeekWorkoutTemplate {
  const id = () => crypto.randomUUID();

  if (goal === "bulk") {
    return {
      mon: [{ id: id(), name: "Upper Push (Chest/Shoulders/Triceps)", done: false }],
      tue: [{ id: id(), name: "Lower (Quads/Glutes)", done: false }],
      wed: [{ id: id(), name: "Upper Pull (Back/Biceps)", done: false }],
      thu: [{ id: id(), name: "Accessory + Arms", done: false }],
      fri: [{ id: id(), name: "Lower (Hamstrings/Glutes)", done: false }],
      sat: [{ id: id(), name: "Optional Pump/Conditioning", done: false }],
      sun: [{ id: id(), name: "Rest / Mobility", done: false }],
    };
  }

  if (goal === "cut") {
    return {
      mon: [{ id: id(), name: "Full Body Strength (Heavy)", done: false }],
      tue: [{ id: id(), name: "Cardio (Zone 2, 30–40m)", done: false }],
      wed: [{ id: id(), name: "Full Body Hypertrophy", done: false }],
      thu: [{ id: id(), name: "Intervals (10×1m hard/1m easy)", done: false }],
      fri: [{ id: id(), name: "Upper/Lower Split (alt. weekly)", done: false }],
      sat: [{ id: id(), name: "Steps 10k + Core", done: false }],
      sun: [{ id: id(), name: "Rest / Mobility", done: false }],
    };
  }

  // maintain
  return {
    mon: [{ id: id(), name: "Full Body A", done: false }],
    tue: [{ id: id(), name: "Light Cardio / Walk", done: false }],
    wed: [{ id: id(), name: "Full Body B", done: false }],
    thu: [{ id: id(), name: "Mobility + Core", done: false }],
    fri: [{ id: id(), name: "Optional Upper Focus", done: false }],
    sat: [{ id: id(), name: "Optional Lower Focus", done: false }],
    sun: [{ id: id(), name: "Rest", done: false }],
  };
}
