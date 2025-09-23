/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CommonRecipe, Ingredient } from "@/components/recipes/types";

/* -------------------- tiny fetch helper -------------------- */
async function j<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json() as Promise<T>;
}

/* -------------------- helpers -------------------- */
function mealToCommon(m: any): CommonRecipe {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || "").trim();
    const measure = (m[`strMeasure${i}`] || "").trim();
    if (!name) continue;
    ingredients.push({ name, measure: measure || undefined });
  }
  return {
    id: String(m.idMeal),
    source: "api",
    title: m.strMeal || "Untitled",
    image: m.strMealThumb || null,
    category: m.strCategory || null,
    area: m.strArea || null,
    ingredients,
    instructions: m.strInstructions || null,
  };
}

function sanitizeIngredient(raw: string): string {
  const s = (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const bits = s.split(" ");
  return bits[bits.length - 1];
}

function coreTerm(raw: string): string {
  const s = sanitizeIngredient(raw);
  const map: Record<string, string> = {
    breast: "chicken",
    thighs: "chicken",
    mince: "beef",
    minced: "beef",
    spaghetti: "pasta",
    penne: "pasta",
    fusilli: "pasta",
    rigatoni: "pasta",
    farfalle: "pasta",
    macaroni: "pasta",
    arborio: "rice",
  };
  return map[s] || s;
}

/* -------------------- API wrappers -------------------- */
export async function getRandomMeals(n = 12): Promise<CommonRecipe[]> {
  const packs = await Promise.all(
    Array.from({ length: n }, () =>
      j<any>("https://www.themealdb.com/api/json/v1/1/random.php")
    )
  );
  const meals = packs
    .map((p) => (p?.meals || [])[0])
    .filter(Boolean)
    .map(mealToCommon);
  const seen = new Set<string>();
  return meals.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export async function searchMealsByName(q: string): Promise<CommonRecipe[]> {
  const s = q.trim();
  if (!s) return [];
  const out = await j<any>(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(s)}`
  );
  const meals: any[] = out?.meals || [];
  return meals.map(mealToCommon);
}

/** Single-ingredient search; returns hydrated recipes. */
export async function searchMealsByIngredient(
  ingredient: string,
  limit = 24
): Promise<CommonRecipe[]> {
  const term = coreTerm(ingredient);
  if (!term) return [];
  const res = await j<any>(
    `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(term)}`
  );
  const list: any[] = res?.meals || [];
  const ids: string[] = list.slice(0, limit).map((m) => String(m.idMeal));
  const full = await Promise.all(ids.map((id) => lookupMealById(id)));
  return (full.filter(Boolean) as CommonRecipe[]);
}

export async function lookupMealById(id: string): Promise<CommonRecipe | null> {
  const res = await j<any>(
    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`
  );
  const meal = res?.meals?.[0];
  return meal ? mealToCommon(meal) : null;
}

/**
 * Multi-ingredient AND search:
 *  - filter.php?i=<term> per term
 *  - intersect meal IDs (strict)
 *  - fallback to union if intersection is empty
 *  - hydrate to full recipes
 */
export async function searchMealsByIngredientsAND(
  rawTerms: string[],
  maxHydrate = 30
): Promise<CommonRecipe[]> {
  const terms = Array.from(new Set(rawTerms.map(coreTerm).filter(Boolean)));
  if (terms.length === 0) return [];

  // Explicit typing so Promise.all resolves to string[][]
  const resultsPerTerm: string[][] = await Promise.all(
    terms.map(async (t): Promise<string[]> => {
      const res = await j<any>(
        `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(t)}`
      ).catch(() => ({ meals: [] }));
      const meals: any[] = res?.meals || [];
      return meals.map((m: any) => String(m.idMeal));
    })
  );

  let ids: string[] = [];
  if (resultsPerTerm.length === 1) {
    ids = resultsPerTerm[0];
  } else {
    const [first, ...rest] = resultsPerTerm;
    const base = new Set<string>(first);
    for (const arr of rest) {
      const s = new Set<string>(arr);
      for (const id of Array.from(base)) {
        if (!s.has(id)) base.delete(id);
      }
    }
    ids = Array.from(base);
  }

  if (ids.length === 0) {
    const union = new Set<string>();
    for (const arr of resultsPerTerm) {
      arr.forEach((id: string) => union.add(id)); // <- typed
    }
    ids = Array.from(union);
  }

  ids = ids.slice(0, maxHydrate);
  const full = await Promise.all(ids.map((id) => lookupMealById(id)));
  const seen = new Set<string>();
  return (full.filter(Boolean) as CommonRecipe[]).filter((r) =>
    seen.has(r.id) ? false : (seen.add(r.id), true)
  );
}
