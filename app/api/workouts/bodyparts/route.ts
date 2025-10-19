import { NextResponse } from "next/server";
import { listTargets } from "@/lib/workouts/exercisedb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const targets = await listTargets();
    return NextResponse.json([...targets].sort((a, b) => a.localeCompare(b)));
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
