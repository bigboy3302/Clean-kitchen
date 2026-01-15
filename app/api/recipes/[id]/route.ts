import { NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";

type MealRecord = Record<string, unknown>;

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseIngredients(meal: MealRecord) {
  const out: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = getString(meal[`strIngredient${i}`]) ?? "";
    const measure = getString(meal[`strMeasure${i}`]) ?? "";
    if (name) out.push({ name, measure });
  }
  return out;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const url = `${BASE}/lookup.php?i=${encodeURIComponent(id)}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    let r: Response;
    try {
      r = await fetch(url, { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(t);
    }

    const data = (await r.json()) as { meals?: MealRecord[] | null };
    const meal = Array.isArray(data?.meals) ? data.meals[0] : null;
    if (!meal) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    return NextResponse.json({
      source: "themealdb",
      id: String(getString(meal.idMeal) ?? ""),
      title: getString(meal.strMeal) ?? "Recipe",
      description: null,
      imageURL: getString(meal.strMealThumb),
      category: getString(meal.strCategory),
      area: getString(meal.strArea),
      timeMinutes: null,
      servings: null,
      ingredients: parseIngredients(meal),
      instructions: getString(meal.strInstructions) ?? "",
      sourceUrl: getString(meal.strSource),
      youtubeUrl: getString(meal.strYoutube),
    });
  } catch (e: unknown) {
    const isAbort =
      typeof e === "object" && e !== null && "name" in e && (e as { name?: unknown }).name === "AbortError";
    if (isAbort) {
      return NextResponse.json({ error: "TheMealDB request timed out" }, { status: 504 });
    }
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
