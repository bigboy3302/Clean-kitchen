import { NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";
const MAX_PAGE_SIZE = 50;

type MealRecord = Record<string, unknown>;

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeListItem(meal: MealRecord) {
  return {
    source: "themealdb" as const,
    id: String(getString(meal.idMeal) ?? ""),
    title: getString(meal.strMeal) ?? "Untitled",
    imageURL: getString(meal.strMealThumb),
    timeMinutes: null,
    servings: null,
    category: null,
    area: null,
  };
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.trunc(parsed);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchMealsForIngredient(ingredient: string): Promise<MealRecord[]> {
  try {
    const url = `${BASE}/filter.php?i=${encodeURIComponent(ingredient)}`;
    const r = await fetch(url, { cache: "no-store" });
    const data = (await r.json()) as { meals?: MealRecord[] | null };
    return Array.isArray(data?.meals) ? data.meals : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const ingredientsRaw = (searchParams.get("ingredients") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const area = (searchParams.get("area") || "").trim();
  const number = clamp(parseNumber(searchParams.get("number"), 24), 1, MAX_PAGE_SIZE);
  const offset = clamp(parseNumber(searchParams.get("offset"), 0), 0, Number.MAX_SAFE_INTEGER);

  try {
    if (area && !ingredientsRaw && !q) {
      const url = `${BASE}/filter.php?a=${encodeURIComponent(area)}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = (await r.json()) as { meals?: MealRecord[] | null };
      const meals = Array.isArray(data?.meals) ? data.meals : [];
      const normalized = meals.map((meal) => ({ ...normalizeListItem(meal), area }));
      const results = normalized.slice(offset, offset + number);
      return NextResponse.json({ results, totalResults: normalized.length, number, offset });
    }

    if (ingredientsRaw) {
      const ingredientList = ingredientsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10); // cap at 10 parallel requests

      // fetch meals for every ingredient in parallel, then score by match count
      const perIngredient = await Promise.all(
        ingredientList.map((ing) => fetchMealsForIngredient(ing))
      );

      const scoreMap = new Map<string, { meal: MealRecord; score: number }>();
      perIngredient.forEach((meals) => {
        meals.forEach((meal) => {
          const id = String(getString(meal.idMeal) ?? "");
          if (!id) return;
          const entry = scoreMap.get(id);
          if (entry) {
            entry.score++;
          } else {
            scoreMap.set(id, { meal, score: 1 });
          }
        });
      });

      // sort best-matching (most pantry ingredients used) first
      const sorted = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
      const normalized = sorted.map(({ meal }) => normalizeListItem(meal));
      const results = normalized.slice(offset, offset + number);

      return NextResponse.json({
        results,
        totalResults: normalized.length,
        number,
        offset,
      });
    }

    if (q) {
      const url = `${BASE}/search.php?s=${encodeURIComponent(q)}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = (await r.json()) as { meals?: MealRecord[] | null };

      const meals = Array.isArray(data?.meals) ? data.meals : [];
      const normalized = meals.map(normalizeListItem);
      const results = normalized.slice(offset, offset + number);
      return NextResponse.json({ results, totalResults: normalized.length, number, offset });
    }

    return NextResponse.json({ results: [], totalResults: 0, number, offset });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
