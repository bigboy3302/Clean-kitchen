export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { searchWorkouts } from "@/lib/workouts/search";
import type { WorkoutSearchFilters } from "@/lib/workouts/types";

const VALID_FILTER_KEYS = new Set(["q", "bodyPart", "target", "equipment"]);

function sanitize(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filters: WorkoutSearchFilters = {};
    for (const key of VALID_FILTER_KEYS) {
      const param = sanitize(searchParams.get(key));
      if (param) filters[key as keyof WorkoutSearchFilters] = param;
    }

    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    const limit = limitParam ? Number(limitParam) : undefined;
    const offset = offsetParam ? Number(offsetParam) : undefined;

    const result = await searchWorkouts({ filters, limit, offset });
    return NextResponse.json(result, {
      headers: { "cache-control": "private, max-age=120" },
    });
  } catch (error) {
    console.error("GET /api/workouts/search failed", error);
    return NextResponse.json({ error: "Failed to load workouts" }, { status: 500 });
  }
}
