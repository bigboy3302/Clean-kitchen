// app/api/recipes/route.ts
import { NextResponse } from "next/server";

/**
 * Primary upstream: Spoonacular via RapidAPI
 * Fallback upstream: TheMealDB (free) so UI still shows something when 429/5xx.
 */

const RAPID_KEY = process.env.RAPIDAPI_KEY!;
const HOST =
  process.env.RAPIDAPI_RECIPES_HOST ||
  process.env.RAPIDAPI_HOST ||
  "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com";

// --- tiny in-memory cache (per server instance) ---
type CacheEntry = { ts: number; data: any };
type CacheMap = Map<string, CacheEntry>;
function getCache(): CacheMap {
  const g = globalThis as any;
  if (!g.__REC_CACHE) g.__REC_CACHE = new Map();
  return g.__REC_CACHE as CacheMap;
}
function cacheKey(path: string, params?: Record<string, any>) {
  const u = new URL(`https://${HOST}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, String(v)));
  return u.toString();
}
function putCache(key: string, data: any, ttlMs = 5 * 60 * 1000) {
  getCache().set(key, { ts: Date.now() + ttlMs, data });
}
function getCached(key: string): any | null {
  const hit = getCache().get(key);
  if (!hit) return null;
  if (Date.now() > hit.ts) {
    getCache().delete(key);
    return null;
  }
  return hit.data;
}

// ---------- types ----------
type SpoonacularIngredient = {
  id?: number;
  name?: string;
  original?: string;
  amount?: number;
  unit?: string;
};

type SpoonacularRecipe = {
  id: number;
  title: string;
  image?: string;
  summary?: string;
  instructions?: string;
  readyInMinutes?: number;
  servings?: number;
  cuisines?: string[];
  extendedIngredients?: SpoonacularIngredient[];
  analyzedInstructions?: Array<{ steps?: Array<{ number: number; step: string }> }>;
};

type CommonRecipe = {
  id: string;
  source: "api";
  title: string;
  image: string | null;
  category: string | null;
  area: string | null;
  ingredients: { name: string; measure?: string | null }[];
  instructions: string | null;
  minutes?: number | null;
  servings?: number | null;
};

// ---------- helpers ----------
function htmlToPlain(s?: string | null): string | null {
  if (!s) return null;
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function toCommon(r: SpoonacularRecipe): CommonRecipe {
  const steps = (r.analyzedInstructions?.[0]?.steps || [])
    .map((s) => (s?.step || "").trim())
    .filter(Boolean);
  const instructions = steps.length ? steps.join("\n") : htmlToPlain(r.instructions ?? null);
  const ingredients =
    (r.extendedIngredients || []).map((i) => ({
      name: i?.name || (i?.original || "").split(" ").slice(-1)[0] || "",
      measure: i?.original || [i?.amount, i?.unit, i?.name].filter(Boolean).join(" ") || null,
    })) || [];
  const cuisine = (r.cuisines && r.cuisines[0]) || null;

  return {
    id: String(r.id),
    source: "api",
    title: r.title || "Untitled",
    image: r.image || null,
    category: null,
    area: cuisine,
    ingredients,
    instructions,
    minutes: r.readyInMinutes ?? null,
    servings: r.servings ?? null,
  };
}

function mealDbToCommon(m: any): CommonRecipe {
  // fallback transformer for TheMealDB
  const ingredients: { name: string; measure?: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || "").trim();
    const measure = (m[`strMeasure${i}`] || "").trim();
    if (name) ingredients.push({ name, measure: measure || null });
  }
  const rawInstr = (m.strInstructions || "").split("\n").map((s: string) => s.trim()).filter(Boolean).join("\n");
  return {
    id: String(m.idMeal),
    source: "api",
    title: m.strMeal || "Untitled",
    image: m.strMealThumb || null,
    category: m.strCategory || null,
    area: m.strArea || null,
    ingredients,
    instructions: rawInstr || null,
    minutes: null,
    servings: null,
  };
}

// ---------- upstream callers with caching & graceful fallback ----------
async function upstream<T>(path: string, params?: Record<string, any>): Promise<T> {
  const key = cacheKey(path, params);
  // try cache first if we’re hitting rate limits a lot
  const cached = getCached(key);
  if (cached) return cached as T;

  const url = new URL(`https://${HOST}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": RAPID_KEY ?? "",
      "X-RapidAPI-Host": HOST,
    },
    cache: "no-store",
  });

  const text = await r.text();
  const body = text ? safeJSON(text) : null;

  if (!r.ok) {
    // If rate-limited or server error, try cache or throw a typed error
    const err = new Error(
      `Upstream ${r.status} ${r.statusText}: ${JSON.stringify({ message: body?.message || body?.status || text || "error" })}`
    ) as any;
    err.status = r.status;
    err.cached = cached;
    throw err;
  }

  const data = (body ?? {}) as T;
  // store small cache (5 min) for common queries
  putCache(key, data, 5 * 60 * 1000);
  return data;
}

function safeJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function spoonacularByName(q: string, limit = 20, area?: string) {
  const params: Record<string, any> = {
    query: q,
    number: Math.min(Math.max(limit, 1), 60),
    addRecipeInformation: true,
  };
  if (area && area !== "any") params.cuisine = area;
  const data = await upstream<{ results: SpoonacularRecipe[] }>("/recipes/complexSearch", params);
  return (data.results || []).map(toCommon);
}

async function spoonacularByIngredients(ings: string[], limit = 20, mode: "intersect" | "union" = "intersect") {
  const ingredientsParam = ings.map((s) => s.trim()).filter(Boolean).slice(0, 10).join(",");
  if (!ingredientsParam) return [];
  const data = await upstream<
    Array<SpoonacularRecipe & { usedIngredientCount?: number; missedIngredientCount?: number }>
  >("/recipes/findByIngredients", {
    ingredients: ingredientsParam,
    number: Math.min(Math.max(limit, 1), 60),
    ranking: 2,
    ignorePantry: true,
  });

  let rows = (data || []).map(toCommon);
  if (mode === "intersect" && ings.length > 1) {
    const terms = ings.map((s) => s.toLowerCase());
    rows = rows.filter((r) => {
      const blob = r.ingredients.map((i) => (i.name + " " + (i.measure || "")).toLowerCase()).join(" ");
      return terms.every((t) => blob.includes(t));
    });
  }
  return rows;
}

async function spoonacularOne(id: string) {
  const data = await upstream<SpoonacularRecipe>(`/recipes/${encodeURIComponent(id)}/information`, {
    includeNutrition: false,
  });
  return toCommon(data);
}

async function spoonacularRandom(n = 10, area?: string) {
  try {
    const r = await upstream<{ recipes: SpoonacularRecipe[] }>("/recipes/random", {
      number: Math.min(Math.max(n, 1), 20),
      ...(area && area !== "any" ? { tags: area } : {}),
    });
    return (r.recipes || []).map(toCommon);
  } catch {
    const alt = await upstream<{ results: SpoonacularRecipe[] }>("/recipes/complexSearch", {
      number: Math.min(Math.max(n, 1), 20),
      addRecipeInformation: true,
      sort: "random",
      ...(area && area !== "any" ? { cuisine: area } : {}),
    });
    return (alt.results || []).map(toCommon);
  }
}

// ---------- TheMealDB fallback ----------
const MEALDB = "https://www.themealdb.com/api/json/v1/1";

async function mealDbRandom(n = 8): Promise<CommonRecipe[]> {
  const packs = await Promise.all(
    Array.from({ length: n }, () =>
      fetch(`${MEALDB}/random.php`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ meals: [] }))
    )
  );
  const meals = packs.map((p) => (p?.meals || [])[0]).filter(Boolean);
  const seen = new Set<string>();
  return meals
    .map(mealDbToCommon)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function mealDbByName(q: string, limit = 24): Promise<CommonRecipe[]> {
  const r = await fetch(`${MEALDB}/search.php?s=${encodeURIComponent(q)}`, { cache: "no-store" }).then((x) => x.json());
  const meals = r?.meals || [];
  return meals.slice(0, limit).map(mealDbToCommon);
}

async function mealDbByIngredients(ings: string[], limit = 24): Promise<CommonRecipe[]> {
  // MealDB only supports one ingredient at a time; union the results and trim
  const ids = new Set<string>();
  for (const ing of ings) {
    const r = await fetch(`${MEALDB}/filter.php?i=${encodeURIComponent(ing)}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => ({ meals: [] }));
    (r?.meals || []).forEach((m: any) => ids.add(String(m.idMeal)));
  }
  const unique = Array.from(ids).slice(0, limit);
  const full = await Promise.all(
    unique.map((id) =>
      fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((x) => x.json())
        .then((j) => j?.meals?.[0] || null)
        .catch(() => null)
    )
  );
  return full.filter(Boolean).map(mealDbToCommon);
}

// ---------- route ----------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const ingredientsParam = (searchParams.get("ingredients") || "").trim();
    const idParam = (searchParams.get("id") || "").trim();
    const randomParam = searchParams.get("random");
    const area = (searchParams.get("area") || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 0) || 0, 1), 60);
    const mode = (searchParams.get("mode") || "intersect") as "intersect" | "union";

    // If we somehow have no RapidAPI key, skip straight to MealDB fallback.
    const spoonReady = !!RAPID_KEY;

    // 1) single
    if (idParam) {
      try {
        const one = spoonReady ? await spoonacularOne(idParam) : null;
        if (one) return NextResponse.json({ ok: true, recipes: [one] });
      } catch (e: any) {
        if (e?.status !== 429) throw e;
      }
      // MealDB fallback for single:
      const m = await fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(idParam)}`, { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => null);
      const rec = m?.meals?.[0] ? mealDbToCommon(m.meals[0]) : null;
      return NextResponse.json({ ok: true, recipes: rec ? [rec] : [] });
    }

    // 2) random
    if (randomParam) {
      const n = Math.min(Math.max(parseInt(randomParam, 10) || 1, 1), 24);
      if (spoonReady) {
        try {
          const list = await spoonacularRandom(n, area || undefined);
          return NextResponse.json({ ok: true, recipes: list });
        } catch (e: any) {
          if (e?.status !== 429) throw e;
        }
      }
      const list = await mealDbRandom(n);
      return NextResponse.json({ ok: true, recipes: list });
    }

    // 3) name search
    if (q) {
      if (spoonReady) {
        try {
          const list = await spoonacularByName(q, limit || 30, area || undefined);
          return NextResponse.json({ ok: true, recipes: list });
        } catch (e: any) {
          if (e?.status !== 429) throw e;
        }
      }
      const list = await mealDbByName(q, limit || 24);
      return NextResponse.json({ ok: true, recipes: list });
    }

    // 4) ingredients search
    if (ingredientsParam) {
      const ings = ingredientsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (spoonReady) {
        try {
          let list = await spoonacularByIngredients(ings, limit || 30, mode);
          if (area && area !== "any") list = list.filter((r) => (r.area || "").toLowerCase() === area);
          return NextResponse.json({ ok: true, recipes: list });
        } catch (e: any) {
          if (e?.status !== 429) throw e;
        }
      }
      const list = await mealDbByIngredients(ings, limit || 24);
      return NextResponse.json({ ok: true, recipes: list });
    }

    // 5) default: small random
    if (spoonReady) {
      try {
        const list = await spoonacularRandom(8, area || undefined);
        return NextResponse.json({ ok: true, recipes: list });
      } catch (e: any) {
        if (e?.status !== 429) throw e;
      }
    }
    const list = await mealDbRandom(8);
    return NextResponse.json({ ok: true, recipes: list });
  } catch (e: any) {
    // last resort: never throw raw upstream to client
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 200 });
  }
}
