import { NextResponse } from "next/server";
import { listEquipment } from "@/lib/workouts/exercisedb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const equipment = await listEquipment();
    return NextResponse.json([...equipment].sort((a, b) => a.localeCompare(b)));
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
