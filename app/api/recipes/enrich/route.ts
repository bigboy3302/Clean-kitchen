
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toHtmlFromAnalyzed(analyzed: any[]): string {
  if (!Array.isArray(analyzed) || analyzed.length === 0) return "";
  const steps = analyzed[0]?.steps || [];
  if (!Array.isArray(steps) || steps.length === 0) return "";
  const list = steps
    .map((s: any) => `<li>${(s?.step || "").toString()}</li>`)
    .join("");
  return `<ol>${list}</ol>`;
}

export async function GET(req: Request) {
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

    const data = await upstream.json();

    const ingredients =
      (data?.extendedIngredients || []).map((ing: any) => ({
        name: ing?.originalName || ing?.name || "",
        amount: ing?.amount ?? null,
        unit: ing?.unit || "",
      })) || [];

    const instructionsHtml =
      (data?.instructions && data.instructions.trim())
        ? `<div>${data.instructions}</div>`
        : toHtmlFromAnalyzed(data?.analyzedInstructions || []);

    const shaped = {
      id: String(data?.id ?? id),
      title: data?.title || "Recipe",
      image: data?.image || null,
      url: data?.sourceUrl || data?.spoonacularSourceUrl || null,
      servings: data?.servings ?? null,
      readyInMinutes: data?.readyInMinutes ?? null,
      calories: (data?.nutrition?.nutrients || []).find((n: any) => n?.name === "Calories")?.amount ?? null,
      ingredients,
      instructionsHtml: instructionsHtml || null,
    };

    return NextResponse.json(shaped);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server-error" }, { status: 500 });
  }
}
