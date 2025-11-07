import { auth, db } from "@/lib/firebas1e";
import {
  collection,
  deleteDoc as deleteDocFs,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import type {
  SaveWorkoutPayload,
  SavedWorkoutOwner,
  SavedWorkoutRecord,
  WorkoutContent,
  WorkoutSearchFilters,
  WorkoutSearchResponse,
} from "@/lib/workouts/types";
import { sanitizeWorkoutContent } from "@/lib/workouts/sanitize";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
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

const SAVED_COLLECTION = "savedWorkouts";
const MAX_RESULTS = 60;

function isBrowser() {
  return typeof window !== "undefined";
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapOwner(data: unknown, fallbackUid: string): SavedWorkoutOwner {
  if (!data || typeof data !== "object") {
    return { uid: fallbackUid, displayName: null, username: null, photoURL: null };
  }
  const raw = data as Partial<SavedWorkoutOwner> & { avatarURL?: string | null };
  return {
    uid: raw.uid || fallbackUid,
    displayName: raw.displayName ?? null,
    username: raw.username ?? null,
    photoURL: raw.photoURL ?? raw.avatarURL ?? null,
  };
}

function blankWorkout(id: string): WorkoutContent {
  return {
    id,
    title: "Workout",
    description: "Details unavailable",
    mediaUrl: null,
    mediaType: "gif",
    previewUrl: null,
    thumbnailUrl: null,
    instructionsHtml: null,
    bodyPart: null,
    target: null,
    equipment: null,
    source: "exerciseDB",
  };
}

function mapClientRecord(id: string, data: DocumentData | undefined): SavedWorkoutRecord {
  if (!data) {
    return {
      id,
      uid: "",
      visibility: "private",
      workout: sanitizeWorkoutContent(blankWorkout(id)),
      owner: { uid: "", displayName: null, username: null, photoURL: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id,
    uid: typeof data.uid === "string" ? data.uid : "",
    visibility: data.visibility === "public" ? "public" : "private",
    workout: sanitizeWorkoutContent((data.workout as WorkoutContent | undefined) ?? blankWorkout(id)),
    owner: mapOwner(data.owner, typeof data.uid === "string" ? data.uid : ""),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

async function fetchOwnerProfile(uid: string): Promise<SavedWorkoutOwner> {
  try {
    const snap = await getDoc(doc(db, "usersPublic", uid));
    if (!snap.exists()) {
      return { uid, displayName: null, username: null, photoURL: null };
    }
    const data = snap.data() as Partial<SavedWorkoutOwner> & { avatarURL?: string | null };
    return {
      uid,
      displayName: data.displayName ?? null,
      username: data.username ?? null,
      photoURL: data.photoURL ?? data.avatarURL ?? null,
    };
  } catch {
    return { uid, displayName: null, username: null, photoURL: null };
  }
}

async function fetchSavedWorkoutsDirect(kind: "me" | "public"): Promise<SavedWorkoutRecord[]> {
  const base = collection(db, SAVED_COLLECTION);
  const constraints = [orderBy("updatedAt", "desc"), limitQuery(MAX_RESULTS)];

  let composed;
  if (kind === "me") {
    const current = auth.currentUser;
    if (!current) throw new Error("AUTH_REQUIRED");
    composed = query(base, where("uid", "==", current.uid), ...constraints);
  } else {
    composed = query(base, where("visibility", "==", "public"), ...constraints);
  }

  const snap = await getDocs(composed);
  return snap.docs.map((docSnap) => mapClientRecord(docSnap.id, docSnap.data()));
}

async function fetchSavedWorkoutsApi(kind: "me" | "public") {
  const endpoint = kind === "me" ? "/api/saved-workouts/me" : "/api/saved-workouts/public";
  const init: RequestInit = { cache: "no-store" };
  if (kind === "me") {
    const current = auth.currentUser;
    if (!current) throw new Error("AUTH_REQUIRED");
    const token = await current.getIdToken();
    init.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }
  const res = await fetchJson<{ items: SavedWorkoutRecord[] }>(endpoint, init);
  return res.items;
}

export async function fetchSavedWorkouts(kind: "me" | "public"): Promise<SavedWorkoutRecord[]> {
  if (isBrowser()) {
    try {
      return await fetchSavedWorkoutsDirect(kind);
    } catch (error) {
      console.warn("Falling back to API for saved workouts:", error);
    }
  }
  return fetchSavedWorkoutsApi(kind);
}

async function saveWorkoutDirect(payload: SaveWorkoutPayload): Promise<SavedWorkoutRecord> {
  const current = auth.currentUser;
  if (!current) throw new Error("AUTH_REQUIRED");
  const workout = sanitizeWorkoutContent(payload.workout);
  const owner = await fetchOwnerProfile(current.uid);
  const now = serverTimestamp();
  const colRef = collection(db, SAVED_COLLECTION);

  if (payload.id) {
    const docRef = doc(colRef, payload.id);
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      throw new Error("Not found");
    }
    if (existing.data()?.uid !== current.uid) {
      throw new Error("Forbidden");
    }
    await updateDoc(docRef, {
      visibility: payload.visibility,
      workout,
      owner,
      updatedAt: now,
    });
    const snap = await getDoc(docRef);
    return mapClientRecord(docRef.id, snap.data());
  }

  const docRef = doc(colRef);
  await setDoc(docRef, {
    uid: current.uid,
    visibility: payload.visibility,
    workout,
    owner,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getDoc(docRef);
  return mapClientRecord(docRef.id, created.data());
}

async function saveWorkoutApi(payload: SaveWorkoutPayload) {
  const current = auth.currentUser;
  if (!current) throw new Error("AUTH_REQUIRED");
  const token = await current.getIdToken();
  return fetchJson<SavedWorkoutRecord>("/api/saved-workouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function saveWorkout(payload: SaveWorkoutPayload): Promise<SavedWorkoutRecord> {
  if (isBrowser()) {
    try {
      return await saveWorkoutDirect(payload);
    } catch (error) {
      console.warn("Falling back to API for saveWorkout:", error);
    }
  }
  return saveWorkoutApi(payload);
}

async function deleteSavedWorkoutDirect(id: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error("AUTH_REQUIRED");
  const docRef = doc(db, SAVED_COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return;
  }
  if (snapshot.data()?.uid !== current.uid) {
    throw new Error("Forbidden");
  }
  await deleteDocFs(docRef);
}

async function deleteSavedWorkoutApi(id: string) {
  const current = auth.currentUser;
  if (!current) throw new Error("AUTH_REQUIRED");
  const token = await current.getIdToken();
  const res = await fetch(`/api/saved-workouts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Failed to delete workout (${res.status})`);
  }
}

export async function deleteSavedWorkout(id: string): Promise<void> {
  if (isBrowser()) {
    try {
      await deleteSavedWorkoutDirect(id);
      return;
    } catch (error) {
      console.warn("Falling back to API for deleteSavedWorkout:", error);
    }
  }
  await deleteSavedWorkoutApi(id);
}
