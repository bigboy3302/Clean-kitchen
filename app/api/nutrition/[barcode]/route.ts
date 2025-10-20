import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Nutriments = Record<string, unknown>;

type Product = {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_url?: string;
  serving_size?: string;
  nutriments?: Nutriments;
};

type OpenFoodFactsResponse = {
  status: number;
  product?: Product;
};

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

const getString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { barcode: string } }
) {
  const code = params.barcode?.trim();
  if (!code) {
    return NextResponse.json({ ok: false, error: "no-barcode" }, { status: 400 });
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 502 });
    }
    const raw: unknown = await res.json();
    const data = (raw ?? {}) as Partial<OpenFoodFactsResponse>;

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

    const product = data.product;
    const nutriments =
      (product.nutriments && typeof product.nutriments === "object"
        ? (product.nutriments as Nutriments)
        : {}) ?? {};

    const getEnergyKcal = (): number | undefined => {
      const kcal = getNumber(nutriments["energy-kcal_100g"]) ?? getNumber(nutriments["energy-kcal"]);
      if (typeof kcal === "number") return kcal;
      const kilojoules = getNumber(nutriments["energy_100g"]);
      if (typeof kilojoules === "number") {
        return Math.round(kilojoules / 4.184);
      }
      return undefined;
    };

    const nutrition = {
      barcode: code,
      productName: getString(product.product_name) ?? getString(product.generic_name),
      brand: getString(product.brands),
      image: getString(product.image_front_small_url) ?? getString(product.image_url),
      servingSize: getString(product.serving_size),
      calories: getEnergyKcal(),
      protein: getNumber(nutriments["proteins_100g"]),
      carbs: getNumber(nutriments["carbohydrates_100g"]),
      sugars: getNumber(nutriments["sugars_100g"]),
      fat: getNumber(nutriments["fat_100g"]),
      fiber: getNumber(nutriments["fiber_100g"]),
      salt: getNumber(nutriments["salt_100g"]),
    };

    return NextResponse.json({ ok: true, nutrition });
  } catch (error: unknown) {
    console.error("Failed to fetch nutrition data", error);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}
