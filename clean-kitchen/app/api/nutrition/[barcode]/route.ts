import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OFF = {
  status: number;
  product?: any;
};

function num(x: any): number | undefined {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: { barcode: string } }
) {
  const code = params.barcode?.trim();
  if (!code) return NextResponse.json({ ok: false, error: "no-barcode" }, { status: 400 });

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 502 });
    }
    const data = (await res.json()) as OFF;

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    const p = data.product;
    const n = p.nutriments || {};
    const nutrition = {
      barcode: code,
      productName: p.product_name || p.generic_name || undefined,
      brand: p.brands || undefined,
      image: p.image_front_small_url || p.image_url || undefined,
      servingSize: p.serving_size || undefined,
      // per 100g values (most consistent in OFF)
      calories: num(n["energy-kcal_100g"]) ?? num(n["energy-kcal"]) ?? (num(n["energy_100g"]) ? Math.round(Number(n["energy_100g"]) / 4.184) : undefined),
      protein: num(n["proteins_100g"]),
      carbs: num(n["carbohydrates_100g"]),
      sugars: num(n["sugars_100g"]),
      fat: num(n["fat_100g"]),
      fiber: num(n["fiber_100g"]),
      salt: num(n["salt_100g"]),
    };

    return NextResponse.json({ ok: true, nutrition });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}
