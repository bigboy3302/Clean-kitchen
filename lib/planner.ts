import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DayPlan = {
  workouts: string[]; // free text or your structured items later
  meals: string[];    // recipe titles/ids/links
};

export type WeekPlan = {
  uid: string;
  week: string; // e.g. 2025-W41
  days: Record<DayKey, DayPlan>;
  createdAt?: any;
  updatedAt?: any;
};

/** ISO week key like "2025-W41" */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // go to Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekRef(uid: string, week = isoWeekKey(), firestore: Firestore = db) {
  return doc(firestore, "users", uid, "planner", week);
}

export function emptyWeek(uid: string, week = isoWeekKey()): WeekPlan {
  return {
    uid,
    week,
    days: {
      mon: { workouts: [], meals: [] },
      tue: { workouts: [], meals: [] },
      wed: { workouts: [], meals: [] },
      thu: { workouts: [], meals: [] },
      fri: { workouts: [], meals: [] },
      sat: { workouts: [], meals: [] },
      sun: { workouts: [], meals: [] },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Read or create the doc (includes uid for your rules). */
export async function loadOrCreateWeek(uid: string, week = isoWeekKey()): Promise<WeekPlan> {
  const ref = weekRef(uid, week);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as WeekPlan;

  const seed = emptyWeek(uid, week);
  await setDoc(ref, seed, { merge: true });
  return seed;
}

/** Bulk save/merge the week. */
export async function saveWeek(plan: WeekPlan): Promise<void> {
  const ref = weekRef(plan.uid, plan.week);
  await setDoc(
    ref,
    { ...plan, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Update a single day in the week. */
export async function saveDay(
  uid: string,
  week: string,
  day: DayKey,
  patch: Partial<DayPlan>
): Promise<void> {
  const ref = weekRef(uid, week);
  await updateDoc(ref, {
    [`days.${day}`]: patch,
    updatedAt: serverTimestamp(),
  });
}
