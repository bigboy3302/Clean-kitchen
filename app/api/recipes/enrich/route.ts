import { NextResponse } from "next/server";

/** Normalize a MealDB recipe to your app’s shape */
function toRecipe(meal: any) {
  const ingredients: { name: string; amount?: string | number; unit?: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    ingredients.push({ name, amount: measure || undefined });
  }

  const instructions = (meal.strInstructions || "").trim();
  const instructionsHtml = instructions
    ? "<p>" +
      instructions
        .split(/\r?\n+/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join("</p><p>") +
      "</p>"
    : "";

  return {
    id: String(meal.idMeal),
    title: meal.strMeal || "Recipe",
    image: meal.strMealThumb || null,
    url: meal.strSource || null,
    servings: null,
    readyInMinutes: null,
    calories: null,
    instructionsHtml,
    ingredients,
  };
}

/** GET /api/recipes/enrich?id=<MealDB id> */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const upstream = await fetch(
      `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`,
      { next: { revalidate: 0 } }
    );

    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const data = (await upstream.json()) as { meals: any[] | null };
    const meal = Array.isArray(data.meals) ? data.meals[0] : null;
    if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(toRecipe(meal));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
