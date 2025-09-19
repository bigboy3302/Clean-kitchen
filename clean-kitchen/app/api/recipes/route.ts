// app/api/recipes/route.ts
import { NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";

type Meal = {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  [k: string]: any; // for strIngredientN / strMeasureN
};

type Recipe = {
  id: string;
  title: string;
  image: string | null;
  category: string | null;
  area: string | null;
  instructions: string | null;
  ingredients: { name: string; measure: string }[];
};

function mealToRecipe(m: Meal): Recipe {
  const ingredients: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || "").trim();
    const measure = (m[`strMeasure${i}`] || "").trim();
    if (name) ingredients.push({ name, measure });
  }
  return {
    id: m.idMeal,
    title: m.strMeal,
    image: m.strMealThumb || null,
    category: m.strCategory || null,
    area: m.strArea || null,
    instructions: m.strInstructions || null,
    ingredients,
  };
}

async function searchByName(q: string): Promise<Recipe[]> {
  const url = `${BASE}/search.php?s=${encodeURIComponent(q)}`;
  const r = await fetch(url, { cache: "no-store" });
  const json = await r.json();
  const meals: Meal[] = json?.meals || [];
  return meals.map(mealToRecipe);
}

async function lookupMany(ids: string[]): Promise<Recipe[]> {
  const unique = Array.from(new Set(ids));
  const limited = unique.slice(0, 24); // be nice
  const results: Recipe[] = [];
  await Promise.all(
    limited.map(async (id) => {
      const r = await fetch(`${BASE}/lookup.php?i=${id}`, { cache: "no-store" });
      const j = await r.json();
      const m = j?.meals?.[0];
      if (m) results.push(mealToRecipe(m));
    })
  );
  return results;
}

async function searchByIngredients(ings: string[]): Promise<Recipe[]> {
  // TheMealDB filter by ingredient is one ingredient per call; we’ll intersect IDs client-side
  const normalized = ings
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5); // cap to 5 to keep it fast

  if (normalized.length === 0) return [];

  // fetch ids per ingredient
  const idSets: Set<string>[] = [];
  for (const ing of normalized) {
    const r = await fetch(`${BASE}/filter.php?i=${encodeURIComponent(ing)}`, {
      cache: "no-store",
    });
    const j = await r.json();
    const meals = (j?.meals || []) as { idMeal: string }[];
    idSets.push(new Set(meals.map((m) => m.idMeal)));
  }

  // intersect
  let intersection = idSets[0];
  for (let i = 1; i < idSets.length; i++) {
    const next = new Set<string>();
    for (const id of intersection) if (idSets[i].has(id)) next.add(id);
    intersection = next;
  }

  return lookupMany(Array.from(intersection));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const ingParam = (searchParams.get("ingredients") || "").trim();

    if (q) {
      const recipes = await searchByName(q);
      return NextResponse.json({ ok: true, recipes });
    }

    if (ingParam) {
      const ing = ingParam.split(",").map((s) => s.trim()).filter(Boolean);
      const recipes = await searchByIngredients(ing);
      return NextResponse.json({ ok: true, recipes });
    }

    return NextResponse.json({ ok: true, recipes: [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
