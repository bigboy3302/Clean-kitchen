export type Nutrition = {
    barcode?: string;
    productName?: string;
    brand?: string;
    image?: string;
    servingSize?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    sugars?: number;
    fat?: number;
    fiber?: number;
    salt?: number;
  };
  
  export async function getNutrition(barcode: string): Promise<Nutrition | null> {
    const res = await fetch(`/api/nutrition/${encodeURIComponent(barcode)}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) return null;
    return json.nutrition as Nutrition;
  }
  