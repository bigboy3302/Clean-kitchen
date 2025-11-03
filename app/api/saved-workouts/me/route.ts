export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/server/auth";
import { toRecord } from "@/lib/workouts/storage";

const COLLECTION = "savedWorkouts";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const uid = user.uid;
    if (!uid) throw new Error("Missing UID");

    const db = await getAdminDb();
    const snapshot = await db
      .collection(COLLECTION)
      .where("uid", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(60)
      .get();

    const items = snapshot.docs.map((doc) => toRecord(doc.id, doc.data()));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/saved-workouts/me failed", error);
    return NextResponse.json({ error: "Failed to load saved workouts" }, { status: 500 });
  }
}
