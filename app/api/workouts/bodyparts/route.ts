export const dynamic = "force-dynamic";

import "server-only";

import data from "@/data/workouts.json";
import { getAdminDb } from "@/lib/firebaseAdmin";

type RawWorkout = {
  bodyPart?: string;
  target?: string;
};

const localWorkouts: RawWorkout[] = Array.isArray(data) ? (data as RawWorkout[]) : [];

function normalizeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export async function GET() {
  try {
    const values = new Set<string>();

    for (const workout of localWorkouts) {
      const bodyPart = normalizeValue(workout.bodyPart);
      const target = normalizeValue(workout.target);
      if (bodyPart) values.add(bodyPart);
      if (target) values.add(target);
    }

    try {
      const db = await getAdminDb();
      const snap = await db
        .collection("workouts")
        .where("visibility", "==", "public")
        .select("bodyPart", "target")
        .limit(400)
        .get();
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const bodyPart = normalizeValue(data.bodyPart);
        const target = normalizeValue(data.target);
        if (bodyPart) values.add(bodyPart);
        if (target) values.add(target);
      });
    } catch (error) {
      console.warn("[workouts.bodyparts] Failed to load Firestore bodyparts", error);
    }

    const sorted = [...values].sort((a, b) => a.localeCompare(b));
    return new Response(JSON.stringify(sorted), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : "Server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
