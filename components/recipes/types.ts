export type Ingredient = {
  name: string;
  measure?: string | null;
};

export type CommonRecipe = {
  id: string;
  source: "api" | "user";
  title: string;
  image: string | null;
  category?: string | null;
  area?: string | null;
  ingredients: Ingredient[];
  instructions?: string | null;
  author?: { uid: string | null; name: string | null } | null;
};
