export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { optionalUser } from "@/lib/server/auth";
import { toRecord } from "@/lib/workouts/storage";

const COLLECTION = "savedWorkouts";

export async function GET(req: NextRequest) {
  try {
    await optionalUser(req); // warms auth, but public list does not require auth
    const db = await getAdminDb();

    const snapshot = await db
      .collection(COLLECTION)
      .where("visibility", "==", "public")
      .orderBy("updatedAt", "desc")
      .limit(60)
      .get();

    const items = snapshot.docs.map((doc) => toRecord(doc.id, doc.data()));
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/saved-workouts/public failed", error);
    return NextResponse.json({ error: "Failed to load public workouts" }, { status: 500 });
  }
}
