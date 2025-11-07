export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/server/auth";
import type {
  SaveWorkoutPayload,
  SavedWorkoutVisibility,
} from "@/lib/workouts/types";
import { fetchOwnerProfile, toRecord } from "@/lib/workouts/storage";
import { sanitizeWorkoutContent } from "@/lib/workouts/sanitize";

const COLLECTION = "savedWorkouts";
const VISIBILITIES: SavedWorkoutVisibility[] = ["public", "private"];

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

    const workout = sanitizeWorkoutContent(payload.workout);
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
