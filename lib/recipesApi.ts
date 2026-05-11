export type Ingredient = { name: string; measure?: string | null };

export type CommonRecipe = {
  id: string;
  source: "api" | "themealdb";
  title: string;
  image: string | null;
  category: string | null;
  area: string | null;
  vegetarian?: boolean | null;
  vegan?: boolean | null;
  calories?: number | null;
  ingredients: Ingredient[];
  instructions: string | null;
  minutes?: number | null;
  servings?: number | null;
};

type ApiResponse = { ok: boolean; recipes: CommonRecipe[]; error?: string };
type SearchOptions = {
  area?: string;
  diet?: string;
  sort?: "match" | "fast" | "calories";
  maxTime?: number | null;
};
type SearchResults = {
  recipes: CommonRecipe[];
  total: number;
  offset: number;
  number: number;
};

type SearchListItem = {
  source?: "themealdb";
  id: string;
  title: string;
  imageURL?: string | null;
  timeMinutes?: number | null;
  servings?: number | null;
  category?: string | null;
  area?: string | null;
};

type SearchResponse = {
  results?: SearchListItem[];
  totalResults?: number;
  number?: number;
  offset?: number;
  note?: string;
};

type MealDbDetail = {
  id: string;
  source?: "themealdb";
  title: string;
  imageURL?: string | null;
  category?: string | null;
  area?: string | null;
  timeMinutes?: number | null;
  servings?: number | null;
  ingredients?: Ingredient[];
  instructions?: string | null;
};

async function j<T = unknown>(url: string): Promise<T> {
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

function fromSearchItem(item: SearchListItem): CommonRecipe {
  return {
    id: String(item.id),
    source: item.source ?? "themealdb",
    title: item.title ?? "Recipe",
    image: item.imageURL ?? null,
    category: item.category ?? null,
    area: item.area ?? null,
    vegetarian: null,
    vegan: null,
    calories: null,
    ingredients: [],
    instructions: null,
    minutes: item.timeMinutes ?? null,
    servings: item.servings ?? null,
  };
}

function fromMealDbDetail(item: MealDbDetail): CommonRecipe {
  return {
    id: String(item.id),
    source: item.source ?? "themealdb",
    title: item.title ?? "Recipe",
    image: item.imageURL ?? null,
    category: item.category ?? null,
    area: item.area ?? null,
    vegetarian: null,
    vegan: null,
    calories: null,
    ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
    instructions: item.instructions ?? null,
    minutes: item.timeMinutes ?? null,
    servings: item.servings ?? null,
  };
}

export async function getRandomMeals(n = 12): Promise<CommonRecipe[]> {
  const data = await j<ApiResponse>(`/api/recipes?random=${encodeURIComponent(String(n))}`);
  return ensureOk(data);
}

export async function searchMealsByName(
  q: string,
  limit = 24,
  options?: SearchOptions
): Promise<CommonRecipe[]> {
  const params = new URLSearchParams({ q, number: String(limit), offset: "0" });
  const data = await j<SearchResponse>(`/api/recipes/search?${params.toString()}`);
  const rows = Array.isArray(data?.results) ? data.results.map(fromSearchItem) : [];
  if (options?.area && options.area !== "any") {
    return rows.filter((recipe) => (recipe.area || "").toLowerCase() === options.area?.toLowerCase());
  }
  return rows;
}

export async function lookupMealById(id: string): Promise<CommonRecipe | null> {
  const data = await j<MealDbDetail>(`/api/recipes/${encodeURIComponent(id)}`);
  return data ? fromMealDbDetail(data) : null;
}

export async function searchMealsByIngredient(term: string, limit = 24): Promise<CommonRecipe[]> {
  const params = new URLSearchParams({ ingredients: term, limit: String(limit), mode: "union" });
  const data = await j<ApiResponse>(`/api/recipes?${params.toString()}`);
  return ensureOk(data);
}

export async function searchMealsByIngredientsAND(
  ings: string[],
  limit = 36,
  _mode: "intersect" | "union" = "intersect",
  options?: SearchOptions
): Promise<CommonRecipe[]> {
  void _mode;
  const params = new URLSearchParams({
    ingredients: ings.join(","),
    number: String(limit),
    offset: "0",
  });
  const data = await j<SearchResponse>(`/api/recipes/search?${params.toString()}`);
  const rows = Array.isArray(data?.results) ? data.results.map(fromSearchItem) : [];
  if (options?.area && options.area !== "any") {
    return rows.filter((recipe) => (recipe.area || "").toLowerCase() === options.area?.toLowerCase());
  }
  return rows;
}

export async function searchMealsByIngredientsPaged(
  ings: string[],
  limit = 12,
  offset = 0,
  options?: SearchOptions
): Promise<SearchResults> {
  const params = new URLSearchParams({
    ingredients: ings.join(","),
    number: String(limit),
    offset: String(offset),
  });
  const data = await j<SearchResponse>(`/api/recipes/search?${params.toString()}`);
  let rows = Array.isArray(data?.results) ? data.results.map(fromSearchItem) : [];
  if (options?.area && options.area !== "any") {
    rows = rows.filter((recipe) => (recipe.area || "").toLowerCase() === options.area?.toLowerCase());
  }
  return {
    recipes: rows,
    total: Number.isFinite(data?.totalResults) ? Number(data?.totalResults) : rows.length,
    offset: Number.isFinite(data?.offset) ? Number(data?.offset) : offset,
    number: Number.isFinite(data?.number) ? Number(data?.number) : limit,
  };
}
