// lib/recipesApi.ts
// Fetch from TheMealDB and normalize to CommonRecipe

import type { CommonRecipe, Ingredient } from "@/components/recipes/types";

const BASE = "https://www.themealdb.com/api/json/v1/1";

async function getJSON<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

function extractIngredients(meal: any): Ingredient[] {
  const out: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    out.push({ name, measure: measure || null });
  }
  return out;
}

function mealToCommon(meal: any): CommonRecipe {
  return {
    id: String(meal.idMeal),
    source: "api",
    title: meal.strMeal || "Untitled",
    image: meal.strMealThumb || null,
    category: meal.strCategory || null,
    area: meal.strArea || null,
    ingredients: extractIngredients(meal),
    instructions: meal.strInstructions || null,
    author: null,
  };
}

export async function lookupMealById(id: string): Promise<CommonRecipe | null> {
  const data = await getJSON<any>(`${BASE}/lookup.php?i=${encodeURIComponent(id)}`);
  const m = data?.meals?.[0];
  return m ? mealToCommon(m) : null;
}

export async function searchMealsByName(q: string, limit = 30): Promise<CommonRecipe[]> {
  const data = await getJSON<any>(`${BASE}/search.php?s=${encodeURIComponent(q)}`);
  const meals = Array.isArray(data?.meals) ? data.meals : [];
  return meals.slice(0, limit).map(mealToCommon);
}

export async function searchMealsByIngredient(ing: string, limit = 24): Promise<CommonRecipe[]> {
  // filter.php returns light objects; we need lookup to get full recipe
  const data = await getJSON<any>(`${BASE}/filter.php?i=${encodeURIComponent(ing)}`);
  const rows: any[] = Array.isArray(data?.meals) ? data.meals : [];
  const ids = rows.slice(0, limit).map((r) => String(r.idMeal));
  const detailed = await Promise.all(ids.map(lookupMealById));
  return detailed.filter(Boolean) as CommonRecipe[];
}

export async function getRandomMeals(n = 16): Promise<CommonRecipe[]> {
  const list = await Promise.all(
    Array.from({ length: n }).map(async () => {
      const data = await getJSON<any>(`${BASE}/random.php`);
      const m = data?.meals?.[0];
      return m ? mealToCommon(m) : null;
    })
  );
  // de-duplicate by id
  const seen = new Set<string>();
  const out: CommonRecipe[] = [];
  for (const r of list) {
    if (!r) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
