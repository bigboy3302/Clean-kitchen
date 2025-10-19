
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzedInstructionStep = {
  step?: string;
};

type AnalyzedInstruction = {
  steps?: AnalyzedInstructionStep[];
};

type ExtendedIngredient = {
  originalName?: string;
  name?: string;
  amount?: number;
  unit?: string;
};

type Nutrient = {
  name?: string;
  amount?: number;
};

type SpoonacularRecipe = {
  id?: number | string;
  title?: string;
  image?: string;
  sourceUrl?: string;
  spoonacularSourceUrl?: string;
  servings?: number;
  readyInMinutes?: number;
  instructions?: string;
  extendedIngredients?: ExtendedIngredient[];
  analyzedInstructions?: AnalyzedInstruction[];
  nutrition?: {
    nutrients?: Nutrient[];
  };
};

const getString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function toHtmlFromAnalyzed(analyzed: unknown): string {
  if (!Array.isArray(analyzed) || analyzed.length === 0) return "";
  const [first] = analyzed as AnalyzedInstruction[];
  if (!first?.steps || !Array.isArray(first.steps) || first.steps.length === 0) return "";
  const list = first.steps
    .map((step) => `<li>${getString(step?.step) ?? ""}</li>`)
    .join("");
  return `<ol>${list}</ol>`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = (searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "missing-id" }, { status: 400 });

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
    const HOST =
      process.env.RAPIDAPI_RECIPES_HOST ||
      "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com";
    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ error: "missing-rapidapi-key" }, { status: 500 });
    }

    const url = `https://${HOST}/recipes/${encodeURIComponent(id)}/information`;

    const upstream = await fetch(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": HOST,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: txt || `upstream-${upstream.status}` },
        { status: upstream.status }
      );
    }

    const raw: unknown = await upstream.json();
    const data = (raw ?? {}) as Partial<SpoonacularRecipe>;
    const extendedIngredients = Array.isArray(data?.extendedIngredients) ? data.extendedIngredients : [];

    const ingredients = extendedIngredients.map((ing) => ({
      name: getString(ing?.originalName) ?? getString(ing?.name) ?? "",
      amount: getNumber(ing?.amount) ?? null,
      unit: getString(ing?.unit) ?? "",
    }));

    const instructionsHtml = getString(data?.instructions)
      ? `<div>${data.instructions}</div>`
      : toHtmlFromAnalyzed(data?.analyzedInstructions);

    const calories =
      Array.isArray(data?.nutrition?.nutrients)
        ? data.nutrition?.nutrients?.find((nutrient) => nutrient?.name === "Calories")?.amount ?? null
        : null;

    const shaped = {
      id: String(data?.id ?? id),
      title: getString(data?.title) ?? "Recipe",
      image: getString(data?.image) ?? null,
      url: getString(data?.sourceUrl) ?? getString(data?.spoonacularSourceUrl) ?? null,
      servings: getNumber(data?.servings) ?? null,
      readyInMinutes: getNumber(data?.readyInMinutes) ?? null,
      calories,
      ingredients,
      instructionsHtml: instructionsHtml || null,
    };

    return NextResponse.json(shaped);
  } catch (error: unknown) {
    console.error("Failed to enrich recipe", error);
    const message = error instanceof Error && error.message ? error.message : "server-error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
