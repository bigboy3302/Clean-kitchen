// app/api/recipes/random/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// simple in-memory cache for the server process
type RecipeSummary = {
  id: string;
  title: string;
  image: string | null;
  description: string;
  instructions: string | null;
  ingredients: Array<{ name: string; measure: string | null }>;
  category: string | null;
  area: string | null;
};
const cache = new Map<string, { at: number; data: RecipeSummary[] }>();
const TTL_MS = 1000 * 60 * 60 * 8; // ~8 hours

type SpoonIngredient = {
  name?: string;
  originalName?: string;
  original?: string;
  amount?: number;
  unit?: string;
  measures?: {
    metric?: { amount?: number; unitShort?: string };
    us?: { amount?: number; unitShort?: string };
  };
};

type SpoonInstructionBlock = { steps?: Array<{ number?: number; step?: string }> };

type RandomRecipe = {
  id?: number | string;
  title?: string;
  image?: string;
  imageUrl?: string;
  summary?: string;
  instructions?: string;
  cuisines?: string[];
  dishTypes?: string[];
  extendedIngredients?: SpoonIngredient[];
  analyzedInstructions?: SpoonInstructionBlock[];
};

type RandomRecipeResponse = {
  recipes?: RandomRecipe[];
};

const getSafeCount = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(3, Math.min(12, Math.floor(parsed)));
};

function todayInRiga(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(input: string | null): string {
  if (!input) return todayInRiga();
  const trimmed = input.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : todayInRiga();
}

function tagsForGoal(goal: string | null | undefined) {
  switch (goal) {
    case "cut":
      return "healthy,low-calorie,high-protein";
    case "bulk":
      return "high-protein,high-calorie";
    default:
      return "healthy,balanced";
  }
}

function stripHtml(html?: string | null) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function shapeInstructions(recipe: RandomRecipe): string {
  if (recipe.instructions && recipe.instructions.trim()) {
    return recipe.instructions.replace(/\r\n/g, "\n").trim();
  }
  const blocks = Array.isArray(recipe.analyzedInstructions) ? recipe.analyzedInstructions : [];
  const steps = blocks
    .flatMap((block) => block?.steps || [])
    .map((step) => step?.step?.trim())
    .filter(Boolean) as string[];
  if (steps.length) return steps.join("\n");
  return "";
}

function measureFromIngredient(ing: SpoonIngredient): string | null {
  if (typeof ing?.original === "string" && ing.original.trim()) return ing.original.trim();
  if (typeof ing?.amount === "number") {
    const unit = (ing.unit || "").trim();
    return `${ing.amount} ${unit}`.trim();
  }
  const metric = ing?.measures?.metric;
  if (metric?.amount) {
    const amt = metric.amount;
    const unit = metric.unitShort || "";
    return `${amt} ${unit}`.trim();
  }
  const us = ing?.measures?.us;
  if (us?.amount) {
    const amt = us.amount;
    const unit = us.unitShort || "";
    return `${amt} ${unit}`.trim();
  }
  return null;
}

function shapeIngredients(recipe: RandomRecipe): Array<{ name: string; measure: string | null }> {
  if (!Array.isArray(recipe.extendedIngredients)) return [];
  return recipe.extendedIngredients
    .map((ing) => {
      const name = (ing?.originalName || ing?.name || "").trim();
      if (!name) return null;
      const measure = measureFromIngredient(ing);
      return { name, measure: measure && measure.length ? measure : null };
    })
    .filter(Boolean) as Array<{ name: string; measure: string | null }>;
}

function shapeCategory(recipe: RandomRecipe): string | null {
  const dishTypes = Array.isArray(recipe.dishTypes) ? recipe.dishTypes : [];
  return dishTypes.length ? dishTypes[0] ?? null : null;
}

function shapeArea(recipe: RandomRecipe): string | null {
  const cuisines = Array.isArray(recipe.cuisines) ? recipe.cuisines : [];
  return cuisines.length ? cuisines[0] ?? null : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const count = getSafeCount(searchParams.get("count"));
    const goal = searchParams.get("goal") || "maintain";
    const date = normalizeDate(searchParams.get("date"));

    const key = `random_recipes_${date}_${goal}_${count}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return NextResponse.json(hit.data);
    }

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
    const HOST = process.env.RAPIDAPI_RECIPES_HOST || "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com";
    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ error: "missing-rapidapi-key" }, { status: 500 });
    }

    // Spoonacular: /recipes/random
    const url = new URL(`https://${HOST}/recipes/random`);
    url.searchParams.set("number", String(count));
    url.searchParams.set("tags", tagsForGoal(goal));
    url.searchParams.set("_date", date);

    const upstream = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": HOST,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      return NextResponse.json({ error: txt || `upstream-${upstream.status}` }, { status: upstream.status });
    }

    const raw: unknown = await upstream.json();
    const json = (raw ?? {}) as RandomRecipeResponse;
    const recipes = Array.isArray(json.recipes) ? json.recipes : [];

    const shaped: RecipeSummary[] = recipes.map((recipe) => {
      const instructions = shapeInstructions(recipe);
      const ingredients = shapeIngredients(recipe);
      const description = stripHtml(recipe.summary) || (instructions ? instructions.split("\n")[0] : "");
      return {
        id: String(recipe?.id ?? ""),
        title: recipe?.title ?? "Recipe",
        image: recipe?.image ?? recipe?.imageUrl ?? null,
        description: description || "Tap to see ingredients & steps.",
        instructions: instructions || null,
        ingredients,
        category: shapeCategory(recipe),
        area: shapeArea(recipe),
      };
    });

    const data = shaped.slice(0, count);
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to fetch random recipes", error);
    const message = error instanceof Error && error.message ? error.message : "server-error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
