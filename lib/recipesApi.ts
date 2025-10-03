// lib/recipesApi.ts

import type { CommonRecipe, Ingredient } from "@/components/recipes/types";

/** Helpers */
function mealToCommon(meal: any): CommonRecipe {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (name) ingredients.push({ name, measure: measure || null });
  }
  return {
    id: String(meal.idMeal),
    source: "api",
    title: meal.strMeal,
    image: meal.strMealThumb || null,
    category: meal.strCategory || null,
    area: meal.strArea || null,
    ingredients,
    instructions: meal.strInstructions || null,
    author: { uid: null, name: null },
  };
}

/** Random meals (N results) */
export async function getRandomMeals(n = 12): Promise<CommonRecipe[]> {
  const reqs = Array.from({ length: n }, () =>
    fetch("https://www.themealdb.com/api/json/v1/1/random.php").then((r) => r.json()).catch(() => null)
  );
  const pages = await Promise.all(reqs);
  const out: CommonRecipe[] = [];
  pages.forEach((p) => {
    const meal = p?.meals?.[0];
    if (meal) out.push(mealToCommon(meal));
  });
  return out;
}

/** Search by name */
export async function searchMealsByName(q: string): Promise<CommonRecipe[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const meals = json?.meals || [];
  return meals.map(mealToCommon);
}

/** Search by a single ingredient (TheMealDB OR-style) */
export async function searchMealsByIngredient(ing: string): Promise<CommonRecipe[]> {
  // filter.php returns light objects (id/name/thumb); we need lookup to hydrate
  const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const meals = json?.meals || [];
  const ids = meals.map((m: any) => String(m.idMeal));
  const details = await Promise.all(ids.map(lookupMealById));
  return details.filter(Boolean) as CommonRecipe[];
}

/** Lookup a single recipe by id */
export async function lookupMealById(id: string): Promise<CommonRecipe | null> {
  const url = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const meal = json?.meals?.[0];
  return meal ? mealToCommon(meal) : null;
}

/**
 * AND-search across multiple ingredients:
 * - Normalizes tokens
 * - Intersects ID sets returned by filter.php?i=
 * - Falls back to ranked-OR when intersection is empty
 * - Hydrates each final id with full details
 */
export async function searchMealsByIngredientsAND(
  rawTerms: string[],
  limit = 36
): Promise<CommonRecipe[]> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const terms = Array.from(
    new Set(
      rawTerms
        .map(norm)
        .filter(Boolean)
        .map((t) => (t.endsWith("s") ? t.slice(0, -1) : t)) // simple plural trim
    )
  );

  if (!terms.length) return [];

  async function idsFor(ing: string): Promise<Set<string>> {
    const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`;
    const res = await fetch(url);
    if (!res.ok) return new Set<string>();
    const json = await res.json();
    const meals = json?.meals || [];
    return new Set(meals.map((m: any) => String(m.idMeal)));
  }

  const sets = await Promise.all(terms.map(idsFor));

  // Intersect
  let inter = sets[0] || new Set<string>();
  for (let i = 1; i < sets.length; i++) {
    const next = new Set<string>();
    inter.forEach((id) => { if (sets[i].has(id)) next.add(id); });
    inter = next;
    if (inter.size === 0) break;
  }

  let finalIds: string[];
  if (inter.size > 0) {
    finalIds = Array.from(inter).slice(0, limit);
  } else {
    // Ranked OR fallback
    const counts = new Map<string, number>();
    sets.forEach((s) => s.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
    finalIds = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, limit);
  }

  const details = await Promise.all(finalIds.map(lookupMealById));
  return details.filter(Boolean) as CommonRecipe[];
}
