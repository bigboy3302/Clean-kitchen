// app/api/workouts/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchExercises } from "@/lib/workouts/exercisedb";

type LegacyExerciseShape = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  descriptionHtml: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentList: string[];
};

const VALID_BODY_PARTS = new Set([
  "back",
  "cardio",
  "chest",
  "lower arms",
  "lower legs",
  "neck",
  "shoulders",
  "upper arms",
  "upper legs",
  "waist",
]);

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const asString = (value: unknown, fallback = ""): string => toTrimmedString(value) ?? fallback;

const parseNonNegativeInt = (value: string | null, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.floor(parsed);
  const bounded = Math.max(0, clamped);
  return Math.min(bounded, max);
};

type ExerciseRecord = Record<string, unknown>;

const toLegacyExercise = (item: ExerciseRecord): LegacyExerciseShape => {
  const id = String(item.id ?? item._id ?? "");
  const name = asString(item.name, "Exercise");
  const bodyPart = asString(item.bodyPart, "unknown");
  const target = asString(item.target, "");
  const equipment = asString(item.equipment, "Bodyweight") || "Bodyweight";
  const gifUrl = asString(item.gifUrl, "");

  return {
    id,
    name,
    bodyPart,
    target,
    equipment,
    gifUrl,
    imageUrl: gifUrl || null,
    imageThumbnailUrl: gifUrl || null,
    descriptionHtml: "",
    primaryMuscles: target ? [target] : [],
    secondaryMuscles: [],
    equipmentList: equipment ? [equipment] : ["Bodyweight"],
  };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let bodyPart = searchParams.get("bodyPart");
    let target = searchParams.get("target");
    const query = searchParams.get("q") ?? undefined;
    const limit = Math.max(1, parseNonNegativeInt(searchParams.get("limit"), 12, 40));
    const offset = parseNonNegativeInt(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);

    if (!target && bodyPart && !VALID_BODY_PARTS.has(bodyPart.toLowerCase())) {
      target = bodyPart;
      bodyPart = null;
    }

    const rawList = await fetchExercises({ search: query ?? undefined, target, bodyPart, limit, offset });
    const list = Array.isArray(rawList) ? rawList : [];

    const shaped: LegacyExerciseShape[] = list.map((item) => toLegacyExercise(item as ExerciseRecord));

    return NextResponse.json(shaped, { headers: { "cache-control": "public, max-age=300" } });
  } catch (error: unknown) {
    console.error("GET /api/workouts failed:", error);
    const message = error instanceof Error && error.message ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
