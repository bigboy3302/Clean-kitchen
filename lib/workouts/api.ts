import type { Exercise, WorkoutsResponse } from "@/lib/workouts/types";

export function extractWorkouts(raw: unknown): Exercise[] {
  if (Array.isArray(raw)) return raw as Exercise[];
  if (raw && typeof raw === "object") {
    const payload = raw as WorkoutsResponse & { items?: unknown };
    if (Array.isArray(payload.items)) {
      return (payload.items as Exercise[]).filter(Boolean);
    }
  }
  return [];
}

export function extractWorkoutsWithMeta(raw: unknown): {
  items: Exercise[];
  page?: number;
  total?: number;
  hasNext?: boolean;
} {
  if (Array.isArray(raw)) {
    return { items: raw as Exercise[] };
  }
  if (raw && typeof raw === "object") {
    const payload = raw as WorkoutsResponse & { items?: unknown };
    if (Array.isArray(payload.items)) {
      return {
        items: (payload.items as Exercise[]).filter(Boolean),
        page: payload.page,
        total: payload.total,
        hasNext: payload.hasNext,
      };
    }
  }
  return { items: [] };
}
