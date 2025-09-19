// components/recipes/types.ts

export type Ingredient = {
  name: string;
  measure?: string | null;
};

export type AuthorInfo = {
  uid?: string | null;
  name?: string | null;
};

export type CommonRecipe = {
  id: string;                // themealdb id or firestore doc id
  source: "api" | "user";    // where it came from
  title: string;
  image?: string | null;
  category?: string | null;  // e.g. "Dessert"
  area?: string | null;      // e.g. "Italian"
  ingredients: Ingredient[];
  instructions?: string | null;
  author?: AuthorInfo | null;
};
