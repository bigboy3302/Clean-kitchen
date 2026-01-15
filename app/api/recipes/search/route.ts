import { NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";
const MAX_PAGE_SIZE = 24;

function normalizeListItem(meal: any) {
  return {
    source: "themealdb" as const,
    id: String(meal.idMeal),
    title: String(meal.strMeal || "Untitled"),
    imageURL: meal.strMealThumb ? String(meal.strMealThumb) : null,
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const ingredientsRaw = (searchParams.get("ingredients") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const number = clamp(parseNumber(searchParams.get("number"), 12), 1, MAX_PAGE_SIZE);
  const offset = clamp(parseNumber(searchParams.get("offset"), 0), 0, Number.MAX_SAFE_INTEGER);

  try {
    let url = "";

    if (ingredientsRaw) {
      const first =
        ingredientsRaw.split(",").map((s) => s.trim()).filter(Boolean)[0] || "";
      if (!first) {
        return NextResponse.json({ results: [], totalResults: 0, number, offset, note: "No ingredient provided." });
      }

      url = `${BASE}/filter.php?i=${encodeURIComponent(first)}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();

      const meals = data?.meals ?? [];
      const normalized = meals.map(normalizeListItem);
      const results = normalized.slice(offset, offset + number);

      return NextResponse.json({
        results,
        totalResults: normalized.length,
        number,
        offset,
        note: ingredientsRaw.includes(",")
          ? "TheMealDB free API supports filtering by a single ingredient; using the first ingredient."
          : undefined,
      });
    }

    if (q) {
      url = `${BASE}/search.php?s=${encodeURIComponent(q)}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();

      const meals = data?.meals ?? [];
      const normalized = meals.map(normalizeListItem);
      const results = normalized.slice(offset, offset + number);
      return NextResponse.json({ results, totalResults: normalized.length, number, offset });
    }

    return NextResponse.json({ results: [], totalResults: 0, number, offset });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
