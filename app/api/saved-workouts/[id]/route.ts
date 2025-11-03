export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/server/auth";

const COLLECTION = "savedWorkouts";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const user = await requireUser(req);
    const uid = user.uid;
    if (!uid) throw new Error("Missing UID");

    const db = await getAdminDb();
    const docRef = db.collection(COLLECTION).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return new NextResponse(null, { status: 204 });
    }
    if (snap.get("uid") !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await docRef.delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/saved-workouts/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete workout" }, { status: 500 });
  }
}
