import { auth } from "@/lib/firebas1e";
import type {
  SaveWorkoutPayload,
  SavedWorkoutRecord,
  WorkoutSearchFilters,
  WorkoutSearchResponse,
} from "@/lib/workouts/types";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function getIdToken(): Promise<string> {
  const current = auth.currentUser;
  if (!current) throw new Error("AUTH_REQUIRED");
  return current.getIdToken();
}

export async function fetchWorkoutSearch(filters: WorkoutSearchFilters, options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.bodyPart) params.set("bodyPart", filters.bodyPart);
  if (filters.target) params.set("target", filters.target);
  if (filters.equipment) params.set("equipment", filters.equipment);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const url = `/api/workouts/search?${params.toString()}`;
  return fetchJson<WorkoutSearchResponse>(url, { cache: "no-store" });
}

export async function fetchWorkoutFilters() {
  return fetchJson<{ bodyParts: string[]; equipment: string[]; targets: string[] }>("/api/workouts/filters", {
    cache: "no-store",
  });
}

export async function fetchSavedWorkouts(kind: "me" | "public"): Promise<SavedWorkoutRecord[]> {
  const init: RequestInit = { cache: "no-store" };

  if (kind === "me") {
    const token = await getIdToken();
    init.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  const endpoint = kind === "me" ? "/api/saved-workouts/me" : "/api/saved-workouts/public";
  const res = await fetchJson<{ items: SavedWorkoutRecord[] }>(endpoint, init);
  return res.items;
}

export async function saveWorkout(payload: SaveWorkoutPayload): Promise<SavedWorkoutRecord> {
  const token = await getIdToken();
  return fetchJson<SavedWorkoutRecord>("/api/saved-workouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedWorkout(id: string): Promise<void> {
  const token = await getIdToken();
  const res = await fetch(`/api/saved-workouts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Failed to delete workout (${res.status})`);
  }
}
