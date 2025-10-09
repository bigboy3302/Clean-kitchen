import { NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

// ExerciseDB canonical bodyPart values
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Inputs coming from your UI
    let bodyPart = searchParams.get("bodyPart");
    let target = searchParams.get("target");
    const query = searchParams.get("q");
    const limit = Math.max(1, Math.min(40, Number(searchParams.get("limit") || 12)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    // TOLERANCE: If bodyPart is provided but isn't a valid bodyPart,
    // treat it as a "target" (e.g., ?bodyPart=abductors => target=abductors).
    if (!target && bodyPart && !VALID_BODY_PARTS.has(bodyPart.toLowerCase())) {
      target = bodyPart;
      bodyPart = null;
    }

    const list = await fetchExercises({
      search: query,
      target,
      bodyPart,
      limit,
      offset,
    });

    const shaped: LegacyExerciseShape[] = list.map((item) => ({
      id: String(item.id),
      name: item.name,
      bodyPart: item.bodyPart,
      target: item.target,
      equipment: item.equipment || "Bodyweight",
      gifUrl: item.gifUrl || "",
      imageUrl: item.gifUrl || null,
      imageThumbnailUrl: item.gifUrl || null,
      descriptionHtml: "",
      primaryMuscles: item.target ? [item.target] : [],
      secondaryMuscles: [],
      equipmentList: item.equipment ? [item.equipment] : ["Bodyweight"],
    }));

    return NextResponse.json(shaped);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
