// app/api/recipes/random/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// simple in-memory cache for the server process
const cache = new Map<string, { at: number; data: any }>();
const TTL_MS = 1000 * 60 * 60 * 20; // ~20 hours

function todayISO(d?: string) {
  if (d) return d.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const count = Math.max(3, Math.min(12, Number(searchParams.get("count") || 3)));
    const goal = searchParams.get("goal") || "maintain";
    const date = todayISO(searchParams.get("date") || undefined);

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

    const json = (await upstream.json()) as { recipes?: any[] };
    const shaped =
      (json.recipes || []).map((r) => ({
        id: String(r.id),
        title: r.title,
        image: r.image || r.imageUrl || null,
      })) || [];

    const data = shaped.slice(0, count);
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server-error" }, { status: 500 });
  }
}