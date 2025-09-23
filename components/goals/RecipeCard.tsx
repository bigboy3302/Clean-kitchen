"use client";

export type Recipe = {
  id: string;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  thumbnail?: string;
  goal: "bulk" | "cut";
};

export default function RecipeCard({ r }: { r: Recipe }) {
  return (
    <div className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md">
      {r.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.thumbnail} alt={r.title} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-gray-100" />
      )}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{r.title}</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs uppercase">
            {r.goal === "bulk" ? "Bulking" : "Cutting"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-gray-600">
          <div><b className="text-gray-900">{r.kcal}</b> kcal</div>
          <div><b className="text-gray-900">{r.protein}g</b> P</div>
          <div><b className="text-gray-900">{r.carbs}g</b> C</div>
          <div><b className="text-gray-900">{r.fat}g</b> F</div>
        </div>
      </div>
    </div>
  );
}
