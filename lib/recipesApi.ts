export type Ingredient = { name: string; measure?: string | null };

export type CommonRecipe = {
  id: string;
  source: "api";
  title: string;
  image: string | null;
  category: string | null;
  area: string | null;
  ingredients: Ingredient[];
  instructions: string | null;
  minutes?: number | null;
  servings?: number | null;
};

type ApiResponse = { ok: boolean; recipes: CommonRecipe[]; error?: string };

async function j<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || `HTTP ${r.status} for ${url}`);
  }
  return (await r.json()) as T;
}

function ensureOk(data: ApiResponse): CommonRecipe[] {
  if (!data.ok) {
    console.warn("[recipesApi] backend said not ok:", data.error);
    return [];
  }
  return Array.isArray(data.recipes) ? data.recipes : [];
}

export async function getRandomMeals(n = 12): Promise<CommonRecipe[]> {
  const data = await j<ApiResponse>(`/api/recipes?random=${encodeURIComponent(String(n))}`);
  return ensureOk(data);
}

export async function searchMealsByName(q: string, limit = 24, area?: string): Promise<CommonRecipe[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (area) params.set("area", area);
  const data = await j<ApiResponse>(`/api/recipes?${params.toString()}`);
  return ensureOk(data);
}

export async function lookupMealById(id: string): Promise<CommonRecipe | null> {
  const data = await j<ApiResponse>(`/api/recipes?id=${encodeURIComponent(id)}`);
  const list = ensureOk(data);
  return list[0] || null;
}

export async function searchMealsByIngredient(term: string, limit = 24): Promise<CommonRecipe[]> {
  const params = new URLSearchParams({ ingredients: term, limit: String(limit), mode: "union" });
  const data = await j<ApiResponse>(`/api/recipes?${params.toString()}`);
  return ensureOk(data);
}

export async function searchMealsByIngredientsAND(
  ings: string[],
  limit = 36,
  mode: "intersect" | "union" = "intersect"
): Promise<CommonRecipe[]> {
  const params = new URLSearchParams({
    ingredients: ings.join(","),
    limit: String(limit),
    mode,
  });
  const data = await j<ApiResponse>(`/api/recipes?${params.toString()}`);
  return ensureOk(data);
}
