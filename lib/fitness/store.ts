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
    primaryMuscles?: (string | number)[];
    secondaryMuscles?: (string | number)[];
    equipmentList?: (string | number)[];
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

export type SuggestedMeal = {
  id: string;
  title: string;
  image?: string | null;
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
  primaryMuscles?: (string | number)[];
  secondaryMuscles?: (string | number)[];
  equipmentList?: (string | number)[];
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
  return hasLS() ? window.localStorage.getItem(k) : (mem.get(k) ?? null);
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
  const cached = safeParse<Metrics>(lsGet(key("metrics")));
  if (cached) return cached;

  try {
    const [{ auth, db }, firestore] = await Promise.all([
      import("@/lib/firebase"),
      import("firebase/firestore"),
    ]);
    const user = auth.currentUser;
    if (!user) return null;
    const snap = await firestore.getDoc(firestore.doc(db, "users", user.uid));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const validActivities = new Set(["sedentary", "light", "moderate", "active", "veryActive"]);
    const validGoals = new Set(["cut", "maintain", "bulk"]);
    const metrics: Metrics = {
      sex: data.sex === "male" || data.sex === "female" ? data.sex : undefined,
      age: typeof data.age === "number" ? data.age : undefined,
      heightCm: typeof data.heightCm === "number" ? data.heightCm : undefined,
      weightKg: typeof data.weightKg === "number" ? data.weightKg : undefined,
      activity: validActivities.has(data.activity) ? data.activity : undefined,
      goal: validGoals.has(data.goal) ? data.goal : undefined,
    };
    const compact: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metrics)) {
      if (v !== undefined && v !== null) compact[k] = v;
    }
    if (Object.keys(compact).length) {
      lsSet(key("metrics"), JSON.stringify(compact));
      return metrics;
    }
    return null;
  } catch (error) {
    console.warn("[fitness] Failed to load metrics from Firestore", error);
    return null;
  }
}
export async function saveMetrics(m: Metrics) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) if (v !== undefined) clean[k] = v;
  lsSet(key("metrics"), JSON.stringify(clean));

  try {
    const [{ auth, db }, firestore] = await Promise.all([
      import("@/lib/firebase"),
      import("firebase/firestore"),
    ]);
    const user = auth.currentUser;
    if (!user) return;
    await firestore.setDoc(
      firestore.doc(db, "users", user.uid),
      {
        ...clean,
        metricsUpdatedAt: firestore.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("[fitness] Failed to persist metrics to Firestore", error);
  }
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

export async function getWeekPlan(targetWeekId?: string): Promise<WeekPlan> {
  const weekId = targetWeekId || isoWeekId(new Date());
  const cached = safeParse<WeekPlan>(lsGet(planKey(weekId)));
  if (cached?.days) {
    // Defensive repair to avoid undefined .items / push errors
    let mutated = false;
    for (const d of DAY_KEYS) {
      if (!cached.days[d]) {
        cached.days[d] = { date: fmtDate(addDays(new Date(cached.startIsoDate), DAY_KEYS.indexOf(d))), items: [] };
        mutated = true;
      } else if (!Array.isArray(cached.days[d].items)) {
        cached.days[d].items = [];
        mutated = true;
      }
    }
    if (mutated) lsSet(planKey(weekId), JSON.stringify(cached));
    return cached;
  }
  const fresh = newEmptyWeekPlan(new Date());
  lsSet(planKey(fresh.weekId), JSON.stringify(fresh));
  return fresh;
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
   “Add to Today” helper (for the library grid)
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
      primaryMuscles: ex.primaryMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      equipmentList: ex.equipmentList,
    },
  };

  await upsertDayItem(wk.weekId, targetDay, item);
  return { weekId: wk.weekId, day: targetDay, item };
}

/* ======================================================================
   Daily meals (client) – pulls from your /api/recipes/random
====================================================================== */
const FALLBACK_MEALS: SuggestedMeal[] = [
  { id: "52772", title: "Teriyaki Chicken Casserole", image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg" },
  { id: "52804", title: "Poutine", image: "https://www.themealdb.com/images/media/meals/uuyrrx1487327597.jpg" },
  { id: "52977", title: "Corba", image: "https://www.themealdb.com/images/media/meals/58oia61564916529.jpg" },
];

function mealsKey(dateIso: string, goal: "cut" | "maintain" | "bulk") {
  return key(`meals:${dateIso}:${goal}`);
}
function todayIso() { return fmtDate(new Date()); }

export async function getOrCreateDailyMeals(
  dateIso?: string,
  _goal: "cut" | "maintain" | "bulk" = "maintain",
  count = 3
) {
  const day = dateIso || todayIso();
  const goal = _goal || "maintain";
  const safeCount = Math.min(Math.max(count, 1), 6);
  const cacheId = mealsKey(day, goal);

  const cached = safeParse<SuggestedMeal[]>(lsGet(cacheId));
  if (Array.isArray(cached) && cached.length >= safeCount) return cached.slice(0, safeCount);

  try {
    const params = new URLSearchParams({ count: String(safeCount), goal, date: day });
    const res = await fetch(`/api/recipes/random?${params.toString()}`, { cache: "no-store" });
    if (res.ok) {
      const list = (await res.json()) as SuggestedMeal[];
      if (Array.isArray(list) && list.length) {
        lsSet(cacheId, JSON.stringify(list));
        return list.slice(0, safeCount);
      }
    }
  } catch {
    // ignore — use fallback
  }

  lsSet(cacheId, JSON.stringify(FALLBACK_MEALS));
  return FALLBACK_MEALS.slice(0, safeCount);
}

/* ======================================================================
   Auth helpers for Weekly page
   - Minimal, safe default works even without Firebase.
   - If you have Firebase auth, uncomment the code below and wire to it.
====================================================================== */

/** Returns the current user id or null. Replace with your real auth if you have it. */
export async function getCurrentUserId(): Promise<string | null> {
  // --- Default: no-op (always "signed in" anonymously) ---
  // Return null if you want Weekly page to require login.
  // return null;

  // If you use Firebase client auth, you can replace with:
  // try {
  //   const { getAuth, onAuthStateChanged } = await import("firebase/auth");
  //   const { app } = await import("@/lib/firebase");
  //   const auth = getAuth(app);
  //   const u = auth.currentUser;
  //   if (u) return u.uid;
  //   return new Promise<string | null>((resolve) =>
  //     onAuthStateChanged(auth, (user) => resolve(user?.uid ?? null), () => resolve(null))
  //   );
  // } catch {
  //   return null;
  // }

  // For now, return a deterministic anonymous id so per-user storage is distinct if desired.
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
  if (!uid) {
    throw new Error("AUTH_REQUIRED");
  }
  return uid;
}
