import { Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import type { SavedWorkoutOwner, SavedWorkoutRecord, WorkoutContent } from "@/lib/workouts/types";

export const COLLECTION = "savedWorkouts";

export function tsToIso(value: Timestamp | Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapOwner(data: unknown, fallbackUid: string): SavedWorkoutOwner {
  if (!data || typeof data !== "object") return { uid: fallbackUid };
  const owner = data as {
    uid?: string;
    displayName?: string | null;
    username?: string | null;
    photoURL?: string | null;
  };
  return {
    uid: owner.uid || fallbackUid,
    displayName: owner.displayName ?? null,
    username: owner.username ?? null,
    photoURL: owner.photoURL ?? null,
  };
}

export function toRecord(id: string, data: DocumentData): SavedWorkoutRecord {
  return {
    id,
    uid: data.uid,
    visibility: data.visibility,
    workout: data.workout as WorkoutContent,
    owner: mapOwner(data.owner, data.uid),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export async function fetchOwnerProfile(uid: string, db: Firestore): Promise<SavedWorkoutOwner> {
  try {
    const snap = await db.collection("usersPublic").doc(uid).get();
    if (!snap.exists) return { uid };
    const data = snap.data() as {
      displayName?: string | null;
      username?: string | null;
      avatarURL?: string | null;
    };
    return {
      uid,
      displayName: data?.displayName ?? null,
      username: data?.username ?? null,
      photoURL: data?.avatarURL ?? null,
    };
  } catch (error) {
    console.warn("Failed to fetch usersPublic doc", error);
    return { uid };
  }
}
