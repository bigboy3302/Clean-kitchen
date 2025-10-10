export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkoutItem = {
  id: string;
  name: string;
  done: boolean;
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
  date: string;         
  items: WorkoutItem[]; 
};

export type WeekPlan = {
  weekId: string;         
  startIsoDate: string;    
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

const LS_PREFIX = "ck:v1:";
const key = (suffix: string) => `${LS_PREFIX}${suffix}`;

function safeParse<T>(json: string | null): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

function fmtDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay(); 
  const diff = (day === 0 ? -6 : 1) - day;
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

export async function getMetrics() {
  return safeParse<Metrics>(localStorage.getItem(key("metrics")));
}
export async function saveMetrics(m: Metrics) {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) if (v !== undefined) clean[k] = v;
  localStorage.setItem(key("metrics"), JSON.stringify(clean));
}

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
  const cached = safeParse<WeekPlan>(localStorage.getItem(planKey(weekId)));
  if (cached?.days) {
  
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
    if (mutated) localStorage.setItem(planKey(weekId), JSON.stringify(cached));
    return cached;
  }
  const fresh = newEmptyWeekPlan(new Date());
  localStorage.setItem(planKey(fresh.weekId), JSON.stringify(fresh));
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
  localStorage.setItem(planKey(plan.weekId), JSON.stringify(plan));
}

export async function toggleDone(weekId: string, day: DayKey, id: string, done: boolean): Promise<void> {
  const plan = await getWeekPlan(weekId);
  const dp = plan.days[day];
  if (!dp?.items) return;
  const idx = dp.items.findIndex((x) => x.id === id);
  if (idx >= 0) {
    dp.items[idx] = { ...dp.items[idx], done: !!done };
    localStorage.setItem(planKey(plan.weekId), JSON.stringify(plan));
  }
}

export async function removeDayItem(weekId: string, day: DayKey, id: string): Promise<void> {
  const plan = await getWeekPlan(weekId);
  const dp = plan.days[day];
  if (!dp?.items) return;
  dp.items = dp.items.filter((x) => x.id !== id);
  plan.days[day] = dp;
  localStorage.setItem(planKey(plan.weekId), JSON.stringify(plan));
}

const FALLBACK_MEALS: SuggestedMeal[] = [
  { id: "52772", title: "Teriyaki Chicken Casserole", image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg" },
  { id: "52804", title: "Poutine", image: "https://www.themealdb.com/images/media/meals/uuyrrx1487327597.jpg" },
  { id: "52977", title: "Corba", image: "https://www.themealdb.com/images/media/meals/58oia61564916529.jpg" },
];

function mealsKey(dateIso: string) { return key(`meals:${dateIso}`); }
function todayIso() { return fmtDate(new Date()); }

export async function getOrCreateDailyMeals(dateIso?: string, _goal: "cut" | "maintain" | "bulk" = "maintain", count = 3) {
  const day = dateIso || todayIso();
  const cached = safeParse<SuggestedMeal[]>(localStorage.getItem(mealsKey(day)));
  if (Array.isArray(cached) && cached.length >= count) return cached.slice(0, count);

  try {
    const res = await fetch(`/api/recipes/suggest?count=${count}`, { cache: "no-store" });
    if (res.ok) {
      const list = (await res.json()) as SuggestedMeal[];
      if (Array.isArray(list) && list.length) {
        localStorage.setItem(mealsKey(day), JSON.stringify(list));
        return list.slice(0, count);
      }
    }
  } catch { /* ignore */ }

  localStorage.setItem(mealsKey(day), JSON.stringify(FALLBACK_MEALS));
  return FALLBACK_MEALS.slice(0, count);
}