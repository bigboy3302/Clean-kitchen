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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bodyPart = searchParams.get("bodyPart");
    const query = searchParams.get("q");
    const limit = Math.max(1, Math.min(40, Number(searchParams.get("limit") || 12)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    const list = await fetchExercises({ search: query, bodyPart, limit, offset });

    const shaped: LegacyExerciseShape[] = list.map((item) => ({
      id: String(item.id),
      name: item.name,
      bodyPart: item.bodyPart,
      target: item.target,
      equipment: item.equipment || "Bodyweight",
      gifUrl: item.gifUrl || "",
      imageUrl: item.gifUrl || null,
      imageThumbnailUrl: item.gifUrl || null,
      descriptionHtml: "", // ExerciseDB doesn't provide descriptions
      primaryMuscles: item.target ? [item.target] : [],
      secondaryMuscles: [],
      equipmentList: item.equipment ? [item.equipment] : ["Bodyweight"],
    }));

    return NextResponse.json(shaped);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
