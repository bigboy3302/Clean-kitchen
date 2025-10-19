// app/api/recipes/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Primary upstream: Spoonacular via RapidAPI
 * Fallback upstream: TheMealDB (free) so UI still shows something when 429/5xx.
 */

const RAPID_KEY = process.env.RAPIDAPI_KEY ?? "";
const HOST =
  process.env.RAPIDAPI_RECIPES_HOST ||
  process.env.RAPIDAPI_HOST ||
  "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com";

// --- tiny in-memory cache (per server instance) ---
type CacheEntry = { ts: number; data: unknown };
type CacheStore = Map<string, CacheEntry>;
type CacheParams = Record<string, string | number | boolean | null | undefined>;
type GlobalWithCache = typeof globalThis & { __REC_CACHE?: CacheStore };
const cacheGlobal = globalThis as GlobalWithCache;

function getCache(): CacheStore {
  if (!cacheGlobal.__REC_CACHE) {
    cacheGlobal.__REC_CACHE = new Map();
  }
  return cacheGlobal.__REC_CACHE;
}

function cacheKey(path: string, params?: CacheParams) {
  const url = new URL(`https://${HOST}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

function putCache(key: string, data: unknown, ttlMs = 5 * 60 * 1000) {
  getCache().set(key, { ts: Date.now() + ttlMs, data });
}

function getCached<T>(key: string): T | null {
  const hit = getCache().get(key);
  if (!hit) return null;
  if (Date.now() > hit.ts) {
    getCache().delete(key);
    return null;
  }
  return hit.data as T;
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

const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const parseLimit = (value: string | null, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

function toCommon(r: SpoonacularRecipe): CommonRecipe {
  const analyzed = Array.isArray(r.analyzedInstructions) ? r.analyzedInstructions : [];
  const steps = (analyzed[0]?.steps || [])
    .map((s) => asTrimmedString(s?.step) ?? "")
    .filter(Boolean);
  const instructions = steps.length ? steps.join("\n") : htmlToPlain(r.instructions ?? null);
  const extended = Array.isArray(r.extendedIngredients) ? r.extendedIngredients : [];
  const ingredients = extended.map((ingredient) => {
    const name = asTrimmedString(ingredient?.name) ?? asTrimmedString(ingredient?.original)?.split(" ").slice(-1)[0] ?? "";
    const measure =
      asTrimmedString(ingredient?.original) ||
      [asNumber(ingredient?.amount), asTrimmedString(ingredient?.unit), asTrimmedString(ingredient?.name)]
        .filter(Boolean)
        .join(" ") ||
      null;
    return { name, measure };
  });
  const cuisine = Array.isArray(r.cuisines) && r.cuisines.length ? r.cuisines[0] ?? null : null;

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

type MealDbRecipe = Record<string, unknown> & {
  idMeal?: string;
  strMeal?: string;
  strMealThumb?: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
};

type MealDbResponse<T> = {
  meals: T[] | null;
};

function mealDbToCommon(meal: MealDbRecipe): CommonRecipe {
  // fallback transformer for TheMealDB
  const ingredients: { name: string; measure?: string | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const nameRaw = meal[`strIngredient${i}`];
    const measureRaw = meal[`strMeasure${i}`];
    const name = asTrimmedString(nameRaw) ?? "";
    const measure = asTrimmedString(measureRaw) ?? "";
    if (name) ingredients.push({ name, measure: measure || null });
  }
  const instructionsSource = asTrimmedString(meal.strInstructions) ?? "";
  const rawInstr = instructionsSource
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
  return {
    id: String(meal.idMeal),
    source: "api",
    title: asTrimmedString(meal.strMeal) ?? "Untitled",
    image: asTrimmedString(meal.strMealThumb) ?? null,
    category: asTrimmedString(meal.strCategory) ?? null,
    area: asTrimmedString(meal.strArea) ?? null,
    ingredients,
    instructions: rawInstr || null,
    minutes: null,
    servings: null,
  };
}

// ---------- upstream callers with caching & graceful fallback ----------
async function upstream<T>(path: string, params?: CacheParams): Promise<T> {
  const key = cacheKey(path, params);
  const cached = getCached<T>(key);
  if (cached) return cached;

  const url = new URL(`https://${HOST}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

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
    const message =
      typeof body === "object" && body !== null && "message" in body && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : typeof body === "object" && body !== null && "status" in body && typeof (body as { status?: unknown }).status === "string"
        ? (body as { status: string }).status
        : text || "error";
    const error = new Error(`Upstream ${r.status} ${r.statusText}: ${message}`) as Error & {
      status: number;
      cached?: T | null;
    };
    error.status = r.status;
    error.cached = cached;
    throw error;
  }

  const data = (body ?? {}) as T;
  putCache(key, data, 5 * 60 * 1000);
  return data;
}

function safeJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function spoonacularByName(q: string, limit = 20, area?: string) {
  const params: CacheParams = {
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
  const packs: MealDbResponse<MealDbRecipe>[] = await Promise.all(
    Array.from({ length: n }, async () => {
      try {
        const response = await fetch(`${MEALDB}/random.php`, { cache: "no-store" });
        const json = (await response.json()) as MealDbResponse<MealDbRecipe>;
        return json;
      } catch {
        return { meals: null };
      }
    })
  );
  const meals = packs
    .map((pack) => (Array.isArray(pack.meals) ? pack.meals[0] ?? null : null))
    .filter((meal): meal is MealDbRecipe => meal !== null);
  const seen = new Set<string>();
  return meals
    .map(mealDbToCommon)
    .filter((recipe) => (seen.has(recipe.id) ? false : (seen.add(recipe.id), true)));
}

async function mealDbByName(q: string, limit = 24): Promise<CommonRecipe[]> {
  try {
    const response = await fetch(`${MEALDB}/search.php?s=${encodeURIComponent(q)}`, { cache: "no-store" });
    const json = (await response.json()) as MealDbResponse<MealDbRecipe>;
    const meals = Array.isArray(json?.meals) ? json.meals : [];
    return meals.slice(0, limit).map(mealDbToCommon);
  } catch {
    return [];
  }
}

async function mealDbByIngredients(ings: string[], limit = 24): Promise<CommonRecipe[]> {
  // MealDB only supports one ingredient at a time; union the results and trim
  const ids = new Set<string>();
  for (const ing of ings) {
    try {
      const response = await fetch(`${MEALDB}/filter.php?i=${encodeURIComponent(ing)}`, { cache: "no-store" });
      const json = (await response.json()) as MealDbResponse<Record<string, unknown> & { idMeal?: string }>;
      const meals = Array.isArray(json?.meals) ? json.meals : [];
      meals.forEach((meal) => {
        const id = asTrimmedString(meal.idMeal);
        if (id) ids.add(id);
      });
    } catch {
      // ignore ingredient failure
    }
  }
  const unique = Array.from(ids).slice(0, limit);
  const full = await Promise.all(
    unique.map((id) =>
      (async () => {
        try {
          const response = await fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(id)}`, { cache: "no-store" });
          const json = (await response.json()) as MealDbResponse<MealDbRecipe>;
          return Array.isArray(json?.meals) ? json.meals?.[0] ?? null : null;
        } catch {
          return null;
        }
      })()
    )
  );
  return full.filter(Boolean).map(mealDbToCommon);
}

// ---------- route ----------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.trim() ?? "";
    const ingredientsParam = searchParams.get("ingredients")?.trim() ?? "";
    const idParam = searchParams.get("id")?.trim() ?? "";
    const randomParam = searchParams.get("random");
    const area = (searchParams.get("area") || "").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 30, 1, 60);
    const mode = searchParams.get("mode") === "union" ? "union" : "intersect";

    const spoonReady = Boolean(RAPID_KEY);

    if (idParam) {
      try {
        const one = spoonReady ? await spoonacularOne(idParam) : null;
        if (one) return NextResponse.json({ ok: true, recipes: [one] });
      } catch (error) {
        if (getErrorStatus(error) !== 429) throw error;
      }

      try {
        const response = await fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(idParam)}`, { cache: "no-store" });
        const json = (await response.json()) as MealDbResponse<MealDbRecipe>;
        const recipe = Array.isArray(json?.meals) && json.meals[0] ? mealDbToCommon(json.meals[0]) : null;
        return NextResponse.json({ ok: true, recipes: recipe ? [recipe] : [] });
      } catch {
        return NextResponse.json({ ok: true, recipes: [] });
      }
    }

    if (randomParam) {
      const n = parseLimit(randomParam, 1, 1, 24);
      if (spoonReady) {
        try {
          const list = await spoonacularRandom(n, area || undefined);
          return NextResponse.json({ ok: true, recipes: list });
        } catch (error) {
          if (getErrorStatus(error) !== 429) throw error;
        }
      }
      const list = await mealDbRandom(n);
      return NextResponse.json({ ok: true, recipes: list });
    }

    if (q) {
      if (spoonReady) {
        try {
          const list = await spoonacularByName(q, limit, area || undefined);
          return NextResponse.json({ ok: true, recipes: list });
        } catch (error) {
          if (getErrorStatus(error) !== 429) throw error;
        }
      }
      const list = await mealDbByName(q, limit);
      return NextResponse.json({ ok: true, recipes: list });
    }

    if (ingredientsParam) {
      const ingredients = ingredientsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (spoonReady) {
        try {
          let list = await spoonacularByIngredients(ingredients, limit, mode);
          if (area && area !== "any") {
            list = list.filter((recipe) => (recipe.area || "").toLowerCase() === area);
          }
          return NextResponse.json({ ok: true, recipes: list });
        } catch (error) {
          if (getErrorStatus(error) !== 429) throw error;
        }
      }
      const list = await mealDbByIngredients(ingredients, limit);
      return NextResponse.json({ ok: true, recipes: list });
    }

    if (spoonReady) {
      try {
        const list = await spoonacularRandom(8, area || undefined);
        return NextResponse.json({ ok: true, recipes: list });
      } catch (error) {
        if (getErrorStatus(error) !== 429) throw error;
      }
    }

    const list = await mealDbRandom(8);
    return NextResponse.json({ ok: true, recipes: list });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error, "Failed") }, { status: 200 });
  }
}
