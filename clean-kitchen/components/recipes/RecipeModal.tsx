// components/recipes/RecipeModal.tsx
"use client";

import { useMemo, useState } from "react";
import type { CommonRecipe } from "./types";

type Props = {
  recipe: CommonRecipe;
  onClose: () => void;
  /** show the current favorite state and let user un-star here */
  isFavorite?: boolean;
  /** called when the user clicks the star */
  onToggleFavorite?: (recipe: CommonRecipe) => void;
};

function parseNumber(txt: string): number | null {
  // supports: "1", "1.5", "1/2", "1 1/2"
  const t = txt.trim();
  if (!t) return null;
  const parts = t.split(" ");
  let total = 0;
  for (const p of parts) {
    if (/^\d+(\.\d+)?$/.test(p)) total += parseFloat(p);
    else if (/^\d+\/\d+$/.test(p)) {
      const [a, b] = p.split("/").map(Number);
      if (b !== 0) total += a / b;
    }
  }
  return total > 0 ? total : null;
}

function splitMeasure(m?: string | null) {
  if (!m) return { value: null as number | null, unit: "" };
  const match = m.match(/^\s*([0-9\s./]+)\s*(.*)$/);
  if (!match) return { value: null, unit: m };
  const value = parseNumber(match[1] || "");
  const unit = (match[2] || "").trim();
  return { value, unit };
}

export default function RecipeModal({
  recipe,
  onClose,
  isFavorite = false,
  onToggleFavorite,
}: Props) {
  const [servings, setServings] = useState<number>(1);

  // scale ingredients by servings (UI shows Instructions first, but list is already scaled)
  const items = useMemo(() => {
    const factor = servings > 0 ? servings : 1;
    return (recipe.ingredients || []).map((ing) => {
      const { value, unit } = splitMeasure(ing.measure || "");
      const scaled =
        value != null
          ? `${(value * factor).toFixed(value % 1 === 0 ? 0 : 2)} ${unit}`.trim()
          : (ing.measure || "");
      return { name: ing.name, measure: scaled };
    });
  }, [recipe.ingredients, servings]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h3 className="title">{recipe.title}</h3>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {recipe.image ? <img className="hero" src={recipe.image} alt={recipe.title} /> : null}

        <div className="row meta">
          {recipe.category ? <span className="chip">{recipe.category}</span> : null}
          {recipe.area ? <span className="chip">{recipe.area}</span> : null}
          <span className="muted">
            {recipe.source === "user"
              ? `by ${recipe.author?.name ?? recipe.author?.uid?.slice(0,6) ?? "User"}`
              : "from TheMealDB"}
          </span>
        </div>

        {/* ORDER YOU ASKED FOR: 1) Instructions */}
        {recipe.instructions ? (
          <section className="sec">
            <h4>Instructions</h4>
            <p className="inst">{recipe.instructions}</p>
          </section>
        ) : null}

        {/* 2) Ingredients (already scaled) */}
        <section className="sec">
          <h4>Ingredients</h4>
          <ul className="ing">
            {items.map((i, idx) => (
              <li key={idx}><strong>{i.name}</strong>{i.measure ? ` — ${i.measure}` : ""}</li>
            ))}
          </ul>
        </section>

        {/* 3) Servings control (placed after ingredients as requested) */}
        <div className="servings">
          <label>Servings</label>
          <input
            className="num"
            type="number"
            min={1}
            value={String(servings)}
            onChange={(e)=>setServings(Math.max(1, Number(e.currentTarget.value) || 1))}
          />
        </div>

        {/* 4) Star button to (un)favorite */}
        <div className="footerRow">
          <button
            className={`star ${isFavorite ? "on" : ""}`}
            onClick={() => onToggleFavorite?.(recipe)}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? "★ Unfavorite" : "☆ Favorite"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.6); display:grid; place-items:center; padding:16px; z-index:1000; }
        .modal { width:100%; max-width: 880px; max-height: 92vh; overflow:auto; background:#fff; border-radius:16px; border:1px solid #e5e7eb; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:14px 16px; border-bottom:1px solid #eef2f7; }
        .title { margin:0; font-size:20px; font-weight:800; color:#0f172a; }
        .x { border:none; background:#0f172a; color:#fff; border-radius:10px; padding:4px 10px; cursor:pointer; }
        .hero { width:100%; max-height: 300px; object-fit:cover; display:block; }
        .row.meta { display:flex; gap:8px; align-items:center; padding:10px 16px 0; color:#64748b; }
        .chip { background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0; padding:2px 8px; border-radius:999px; font-size:12px; }
        .muted { margin-left:auto; font-size:12px; }
        .sec { padding: 10px 16px 0; }
        h4 { margin: 10px 0 6px; }
        .ing { margin:0; padding: 0 0 0 18px; }
        .inst { white-space:pre-wrap; margin:0; }
        .servings { display:flex; align-items:center; gap:8px; padding:14px 16px; }
        .num { width:90px; border:1px solid #d1d5db; border-radius:10px; padding:6px 10px; }
        .footerRow { display:flex; justify-content:flex-end; padding:0 16px 14px; }
        .star { border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:8px 12px; cursor:pointer; }
        .star.on { background:#fde68a; border-color:#f59e0b; }
      `}</style>
    </div>
  );
}
