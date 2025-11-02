export const dynamic = "force-dynamic";

import data from "@/data/workouts.json";

type RawWorkout = {
  bodyPart?: string;
  target?: string;
};

const workouts = Array.isArray(data) ? (data as RawWorkout[]) : [];

export async function GET() {
  try {
    const values = new Set<string>();
    for (const workout of workouts) {
      const target = workout.target?.trim();
      const bodyPart = workout.bodyPart?.trim();
      if (target) values.add(target.toLowerCase());
      if (bodyPart) values.add(bodyPart.toLowerCase());
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
