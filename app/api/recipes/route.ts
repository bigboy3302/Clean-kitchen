
import { NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";

type Meal = {
  idMeal: string;
  strMeal: string;
  strMealThumb: string | null;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  [k: string]: any; // strIngredientN / strMeasureN
};

export type Recipe = {
  id: string;
  title: string;
  image: string | null;
  category: string | null;
  area: string | null;
  instructions: string | null;
  ingredients: { name: string; measure?: string | null }[];
};

function mealToRecipe(m: Meal): Recipe {
  const ingredients: Recipe["ingredients"] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || "").trim();
    const measure = (m[`strMeasure${i}`] || "").trim();
    if (name) ingredients.push({ name, measure: measure || null });
  }
  return {
    id: String(m.idMeal),
    title: m.strMeal,
    image: m.strMealThumb || null,
    category: m.strCategory || null,
    area: m.strArea || null,
    instructions: m.strInstructions || null,
    ingredients,
  };
}


function sanitizeIngredient(raw: string): string {
  const s = raw
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


async function j<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json() as Promise<T>;
}

async function lookupOne(id: string): Promise<Recipe | null> {
  const res = await j<any>(`${BASE}/lookup.php?i=${encodeURIComponent(id)}`);
  const m: Meal | undefined = res?.meals?.[0];
  return m ? mealToRecipe(m) : null;
}

async function lookupMany(ids: string[], limit = 30): Promise<Recipe[]> {
  const unique = Array.from(new Set(ids)).slice(0, limit);
  const full = await Promise.all(unique.map((id) => lookupOne(id)));
  return (full.filter(Boolean) as Recipe[]);
}

async function randomMeals(n = 12): Promise<Recipe[]> {
  const packs = await Promise.all(
    Array.from({ length: n }, () => j<any>(`${BASE}/random.php`).catch(() => ({ meals: [] })))
  );
  const meals = packs.map((p) => (p?.meals || [])[0]).filter(Boolean) as Meal[];
  const seen = new Set<string>();
  return meals
    .map(mealToRecipe)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function searchByName(q: string): Promise<Recipe[]> {
  const res = await j<any>(`${BASE}/search.php?s=${encodeURIComponent(q)}`);
  const meals: Meal[] = res?.meals || [];
  return meals.map(mealToRecipe);
}

async function idsByIngredient(term: string): Promise<string[]> {
  const t = coreTerm(term);
  if (!t) return [];
  const res = await j<any>(`${BASE}/filter.php?i=${encodeURIComponent(t)}`).catch(() => ({ meals: [] }));
  const meals: any[] = res?.meals || [];
  return meals.map((m) => String(m.idMeal));
}

async function searchByIngredientsAND(ings: string[], limit = 30, mode: "intersect" | "union" = "intersect"): Promise<Recipe[]> {
  const terms = Array.from(new Set(ings.map(coreTerm).filter(Boolean))).slice(0, 6);
  if (terms.length === 0) return [];

  const perTerm: string[][] = await Promise.all(terms.map(idsByIngredient));
  let ids: string[] = [];

  if (perTerm.length === 1) {
    ids = perTerm[0];
  } else if (mode === "intersect") {
    const [first, ...rest] = perTerm;
    const base = new Set(first);
    for (const arr of rest) {
      const s = new Set(arr);
      for (const id of Array.from(base)) if (!s.has(id)) base.delete(id);
    }
    ids = Array.from(base);
    if (ids.length === 0) {
      const u = new Set<string>();
      perTerm.forEach((arr) => arr.forEach((id) => u.add(id)));
      ids = Array.from(u);
    }
  } else {
    const u = new Set<string>();
    perTerm.forEach((arr) => arr.forEach((id) => u.add(id)));
    ids = Array.from(u);
  }

  ids = ids.slice(0, limit);
  return await lookupMany(ids, limit);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const ingredientsParam = (searchParams.get("ingredients") || "").trim(); 
    const randomParam = searchParams.get("random");
    const idParam = (searchParams.get("id") || "").trim();
    const area = (searchParams.get("area") || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 0) || 0, 1), 60); 
    const mode = (searchParams.get("mode") || "intersect") as "intersect" | "union";

   
    if (idParam) {
      const one = await lookupOne(idParam);
      return NextResponse.json({ ok: true, recipes: one ? [one] : [] });
    }

   
    if (randomParam) {
      const n = Math.min(Math.max(parseInt(randomParam, 10) || 1, 1), 24);
      let list = await randomMeals(n);
      if (area) list = list.filter((r) => (r.area || "").toLowerCase() === area);
      return NextResponse.json({ ok: true, recipes: list });
    }

  
    if (q) {
      let list = await searchByName(q);
      if (area) list = list.filter((r) => (r.area || "").toLowerCase() === area);
      if (limit) list = list.slice(0, limit);
      return NextResponse.json({ ok: true, recipes: list });
    }

  
    if (ingredientsParam) {
      const ings = ingredientsParam.split(",").map((s) => s.trim()).filter(Boolean);
      let list = await searchByIngredientsAND(ings, limit || 30, mode);
      if (area) list = list.filter((r) => (r.area || "").toLowerCase() === area);
      if (limit) list = list.slice(0, limit);
      return NextResponse.json({ ok: true, recipes: list });
    }

   
    return NextResponse.json({ ok: true, recipes: [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
