export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listBodyParts, listEquipment, listTargets } from "@/lib/workouts/exercisedb";
import { fallbackUniqueBodyParts, fallbackUniqueEquipment, fallbackUniqueTargets } from "@/lib/workouts/fallback";

export async function GET() {
  try {
    const [bodyParts, equipment, targets] = await Promise.all([
      listBodyParts().catch(() => []),
      listEquipment().catch(() => []),
      listTargets().catch(() => []),
    ]);

    const resolvedBodyParts = bodyParts.length ? bodyParts : fallbackUniqueBodyParts();
    const resolvedEquipment = equipment.length ? equipment : fallbackUniqueEquipment();
    const resolvedTargets = targets.length ? targets : fallbackUniqueTargets();

    return NextResponse.json({
      bodyParts: resolvedBodyParts.sort((a, b) => a.localeCompare(b)),
      equipment: resolvedEquipment.sort((a, b) => a.localeCompare(b)),
      targets: resolvedTargets.sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    console.error("GET /api/workouts/filters failed", error);
    return NextResponse.json({
      bodyParts: fallbackUniqueBodyParts(),
      equipment: fallbackUniqueEquipment(),
      targets: fallbackUniqueTargets(),
    });
  }
}
