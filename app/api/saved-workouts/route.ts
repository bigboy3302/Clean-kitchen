export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/server/auth";
import type {
  SaveWorkoutPayload,
  SavedWorkoutVisibility,
  WorkoutContent,
} from "@/lib/workouts/types";
import { fetchOwnerProfile, toRecord } from "@/lib/workouts/storage";

const COLLECTION = "savedWorkouts";
const VISIBILITIES: SavedWorkoutVisibility[] = ["public", "private"];

function sanitizeWorkout(workout: WorkoutContent | undefined | null): WorkoutContent {
  if (!workout) throw new Error("Workout payload missing");

  const title = (workout.title || "Workout").toString().trim();
  const description = (workout.description || "").toString().trim();
  if (!title) throw new Error("Workout title required");
  if (!description) throw new Error("Workout description required");

  const safeHtml = (workout.instructionsHtml || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "");

  const clamp = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const trimmed = value.toString().trim();
    return trimmed.length ? trimmed : null;
  };

  const norm = {
    id: workout.id?.toString() || crypto.randomUUID(),
    title,
    mediaUrl: clamp(workout.mediaUrl),
    mediaType: workout.mediaType === "mp4" ? "mp4" : workout.mediaType === "image" ? "image" : "gif",
    previewUrl: clamp(workout.previewUrl) || clamp(workout.mediaUrl),
    thumbnailUrl: clamp(workout.thumbnailUrl) || clamp(workout.previewUrl) || clamp(workout.mediaUrl),
    description: description.slice(0, 2000),
    instructionsHtml: safeHtml ? safeHtml.slice(0, 8000) : null,
    bodyPart: clamp(workout.bodyPart),
    target: clamp(workout.target),
    equipment: clamp(workout.equipment),
    source: workout.source || "exerciseDB",
    primaryMuscles: Array.isArray(workout.primaryMuscles)
      ? workout.primaryMuscles.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 8)
      : undefined,
    secondaryMuscles: Array.isArray(workout.secondaryMuscles)
      ? workout.secondaryMuscles.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 8)
      : undefined,
    equipmentList: Array.isArray(workout.equipmentList)
      ? workout.equipmentList.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 8)
      : undefined,
    externalUrl: clamp(workout.externalUrl),
  } satisfies WorkoutContent;

  return norm;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const uid = user.uid;
    if (!uid) throw new Error("Missing UID");

    const payload = (await req.json()) as SaveWorkoutPayload;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!VISIBILITIES.includes(payload.visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }

    const workout = sanitizeWorkout(payload.workout);
    const db = await getAdminDb();
    const owner = await fetchOwnerProfile(uid, db);

    if (payload.id) {
      const docRef = db.collection(COLLECTION).doc(payload.id);
      const existing = await docRef.get();
      if (!existing.exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (existing.get("uid") !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await docRef.update({
        visibility: payload.visibility,
        workout,
        owner,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const updated = await docRef.get();
      return NextResponse.json(toRecord(updated.id, updated.data() || {}));
    }

    const docRef = db.collection(COLLECTION).doc();
    await docRef.set({
      uid,
      visibility: payload.visibility,
      workout,
      owner,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const created = await docRef.get();
    return NextResponse.json(toRecord(created.id, created.data() || {}), { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }
    console.error("POST /api/saved-workouts failed", error);
    return NextResponse.json({ error: "Failed to save workout" }, { status: 500 });
  }
}
