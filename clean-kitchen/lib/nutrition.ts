// lib/nutrition.ts
export type NutritionInfo = {
  name?: string | null;
  servingSize?: string | null;

  // calories
  kcalPer100g?: number | null;
  kcalPerServing?: number | null;

  // macros (per 100g)
  carbs100g?: number | null;
  sugars100g?: number | null;
  fiber100g?: number | null;
  protein100g?: number | null;
  fat100g?: number | null;
  satFat100g?: number | null;
  salt100g?: number | null;
  sodium100g?: number | null;
};

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchNutritionByBarcode(barcode: string): Promise<NutritionInfo | null> {
  if (!/^\d{6,}$/.test(barcode)) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode
  )}.json?fields=product_name,product_name_en,serving_size,nutriments`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OpenFoodFacts error: ${res.status}`);
  const data = await res.json();

  const p = data?.product;
  if (!p) return null;

  const nm = (p.product_name_en || p.product_name || "").trim() || null;
  const n = p.nutriments || {};

  return {
    name: nm,
    servingSize: p.serving_size || null,

    kcalPer100g: toNum(n["energy-kcal_100g"] ?? n["energy-kcal_100ml"]),
    kcalPerServing: toNum(n["energy-kcal_serving"]),

    carbs100g: toNum(n["carbohydrates_100g"]),
    sugars100g: toNum(n["sugars_100g"]),
    fiber100g: toNum(n["fiber_100g"]),
    protein100g: toNum(n["proteins_100g"]),
    fat100g: toNum(n["fat_100g"]),
    satFat100g: toNum(n["saturated-fat_100g"]),
    salt100g: toNum(n["salt_100g"]),
    sodium100g: toNum(n["sodium_100g"]),
  };
}
