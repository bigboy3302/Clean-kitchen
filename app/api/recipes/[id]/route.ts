import { NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";

function parseIngredients(meal: any) {
  const out: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
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

    const data = await r.json();

    const meal = data?.meals?.[0];
    if (!meal) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    return NextResponse.json({
      source: "themealdb",
      id: String(meal.idMeal),
      title: meal.strMeal,
      description: null,
      imageURL: meal.strMealThumb || null,
      category: meal.strCategory || null,
      area: meal.strArea || null,
      timeMinutes: null,
      servings: null,
      ingredients: parseIngredients(meal),
      instructions: meal.strInstructions || "",
      sourceUrl: meal.strSource || null,
      youtubeUrl: meal.strYoutube || null,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return NextResponse.json({ error: "TheMealDB request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
