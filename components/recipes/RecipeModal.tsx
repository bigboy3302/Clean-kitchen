"use client";

import { useMemo, useState, useEffect } from "react";
import { CommonRecipe } from "./types";

type Props = {
  recipe: CommonRecipe;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (r: CommonRecipe) => void;
  zIndex?: number; // default 2000, higher than favorites overlay
};

function parseNumber(txt: string): number | null {
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
  zIndex = 2000,
}: Props) {
  const [servings, setServings] = useState<number>(1);

  // lock wheel scroll on background (extra safety; page also locks body)
  useEffect(() => {
    const stop = (e: WheelEvent) => e.preventDefault();
    document.addEventListener("wheel", stop, { passive: false });
    return () => document.removeEventListener("wheel", stop);
  }, []);

  const items = useMemo(() => {
    const factor = servings > 0 ? servings : 1;
    return (recipe.ingredients || []).map((i) => {
      const { value, unit } = splitMeasure(i.measure || "");
      const scaled =
        value != null ? `${(value * factor).toFixed(value % 1 === 0 ? 0 : 2)} ${unit}`.trim() : (i.measure || "");
      return { name: i.name, measure: scaled };
    });
  }, [recipe.ingredients, servings]);

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ zIndex }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h3 className="title">{recipe.title}</h3>
          <div className="right">
            <button
              className={`star ${isFavorite ? "on" : ""}`}
              title={isFavorite ? "Unfavorite" : "Favorite"}
              onClick={() => onToggleFavorite?.(recipe)}
            >★</button>
            <button className="x" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {recipe.image ? <img className="hero" src={recipe.image} alt={recipe.title} /> : null}

        <div className="row">
          {recipe.category ? <span className="chip">{recipe.category}</span> : null}
          {recipe.area ? <span className="chip">{recipe.area}</span> : null}
          <span className="muted">
            {recipe.source === "user"
              ? `by ${recipe.author?.name ?? recipe.author?.uid?.slice(0,6) ?? "User"}`
              : "from TheMealDB"}
          </span>
        </div>

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

        <div className="cols">
          <section>
            <h4>Ingredients</h4>
            <ul className="ing">
              {items.map((i, idx) => (
                <li key={idx}><strong>{i.name}</strong>{i.measure ? ` — ${i.measure}` : ""}</li>
              ))}
            </ul>
          </section>

          {recipe.instructions ? (
            <section>
              <h4>Instructions</h4>
              <p className="inst">{recipe.instructions}</p>
            </section>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.6); display:grid; place-items:center; padding:16px; }
        .modal { width:100%; max-width: 880px; max-height: 92vh; overflow:auto; background:#fff; border-radius:16px; border:1px solid #e5e7eb; }
        .head { position:sticky; top:0; background:#fff; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:14px 16px; border-bottom:1px solid #eef2f7; }
        .title { margin:0; font-size:20px; font-weight:800; color:#0f172a; }
        .right { display:flex; gap:8px; align-items:center; }
        .x { border:none; background:#0f172a; color:#fff; border-radius:10px; padding:4px 10px; cursor:pointer; }
        .star{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer}
        .star.on{background:#fde68a;border-color:#f59e0b}
        .hero { width:100%; max-height: 320px; object-fit:cover; display:block; }
        .row { display:flex; gap:8px; align-items:center; padding:10px 16px 0; color:#64748b; }
        .chip { background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0; padding:2px 8px; border-radius:999px; font-size:12px; }
        .muted { margin-left:auto; font-size:12px; }
        .servings { display:flex; align-items:center; gap:8px; padding:10px 16px; }
        .num { width:90px; border:1px solid #d1d5db; border-radius:10px; padding:6px 10px; }
        .cols { display:grid; grid-template-columns: 1fr 1fr; gap:16px; padding: 0 16px 16px; }
        @media (max-width: 820px){ .cols { grid-template-columns: 1fr; } }
        h4 { margin: 10px 0 6px; }
        .ing { margin:0; padding-left:18px; }
        .inst { white-space:pre-wrap; margin:0; }
      `}</style>
    </div>
  );
}
