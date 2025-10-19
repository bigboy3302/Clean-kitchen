// app/api/recipes/random/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// simple in-memory cache for the server process
type RecipeSummary = { id: string; title: string; image: string | null };
const cache = new Map<string, { at: number; data: RecipeSummary[] }>();
const TTL_MS = 1000 * 60 * 60 * 20; // ~20 hours

type RandomRecipe = {
  id?: number | string;
  title?: string;
  image?: string;
  imageUrl?: string;
};

type RandomRecipeResponse = {
  recipes?: RandomRecipe[];
};

const getSafeCount = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(3, Math.min(12, Math.floor(parsed)));
};

const todayISO = (override?: string | null): string => {
  if (override && override.trim()) return override.trim().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
};

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const count = getSafeCount(searchParams.get("count"));
    const goal = searchParams.get("goal") || "maintain";
    const date = todayISO(searchParams.get("date"));

    const key = `random|${date}|${goal}|${count}`;
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

    const shaped: RecipeSummary[] = recipes.map((recipe) => ({
      id: String(recipe?.id ?? ""),
      title: recipe?.title ?? "Recipe",
      image: recipe?.image ?? recipe?.imageUrl ?? null,
    }));

    const data = shaped.slice(0, count);
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to fetch random recipes", error);
    const message = error instanceof Error && error.message ? error.message : "server-error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
