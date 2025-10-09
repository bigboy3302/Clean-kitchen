import { NextResponse } from "next/server";
import { listTargets } from "@/lib/workouts/exercisedb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const targets = await listTargets();
    // sort for stable UI
    return NextResponse.json([...targets].sort((a, b) => a.localeCompare(b)));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
