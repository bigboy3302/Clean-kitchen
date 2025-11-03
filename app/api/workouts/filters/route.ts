export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listBodyParts, listEquipment, listTargets } from "@/lib/workouts/exercisedb";

export async function GET() {
  try {
    const [bodyParts, equipment, targets] = await Promise.all([
      listBodyParts().catch(() => []),
      listEquipment().catch(() => []),
      listTargets().catch(() => []),
    ]);

    return NextResponse.json({
      bodyParts: bodyParts.sort((a, b) => a.localeCompare(b)),
      equipment: equipment.sort((a, b) => a.localeCompare(b)),
      targets: targets.sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    console.error("GET /api/workouts/filters failed", error);
    return NextResponse.json({ error: "Failed to load filters" }, { status: 500 });
  }
}
