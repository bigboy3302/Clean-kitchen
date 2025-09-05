"use client";

import Card from "@/components/ui/Card";

type Props = {
  recipe: {
    id: string;
    title: string;
    description?: string | null;
    imageURL?: string | null;
    ingredients?: Array<{ name: string; qty?: number; unit?: string }>;
  };
};

export default function RecipeCard({ recipe }: Props) {
  return (
    <Card className="rc">
      {recipe.imageURL ? (
        <div className="thumb">
          <img src={recipe.imageURL} alt={recipe.title} />
        </div>
      ) : (
        <div className="thumb placeholder">
          <span>No image</span>
        </div>
      )}

      <div className="body">
        <h3 className="title">{recipe.title}</h3>
        {recipe.description && <p className="desc">{recipe.description}</p>}
        <div className="meta">
          {Array.isArray(recipe.ingredients) && (
            <span>{recipe.ingredients.length} ingredients</span>
          )}
        </div>
      </div>

      <style jsx>{`
        .rc { padding: 0; overflow: hidden; }
        .thumb { height: 160px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .thumb.placeholder span { color: #6b7280; font-size: 13px; }
        .body { padding: 12px 14px; }
        .title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 6px; }
        .desc { font-size: 14px; color: #4b5563; margin: 0 0 8px; }
        .meta { font-size: 12px; color: #6b7280; }
      `}</style>
    </Card>
  );
}
