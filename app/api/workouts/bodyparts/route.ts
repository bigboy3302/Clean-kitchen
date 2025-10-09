import { NextResponse } from "next/server";
import { listBodyParts } from "@/lib/workouts/exercisedb";

export async function GET() {
  try {
    const list = await listBodyParts();
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
