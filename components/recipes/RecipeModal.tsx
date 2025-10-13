"use client";

import React from "react";
import type { CommonRecipe, Ingredient } from "./types";

type Props = {
  recipe: CommonRecipe;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (r: CommonRecipe) => void | Promise<void>;
};

function ItemRow({ name, measure }: Ingredient) {
  return (
    <li className="ir">
      <span className="nm">{name}</span>
      {measure ? <span className="msr">{measure}</span> : null}
      <style jsx>{`
        .ir { display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px dashed var(--border); }
        .nm { font-weight:600; color:var(--text); }
        .msr { color:var(--muted); font-size:13px; }
      `}</style>
    </li>
  );
}

export default function RecipeModal({ recipe, isFavorite, onToggleFavorite, onClose }: Props) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = (recipe.instructions ? String(recipe.instructions) : "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  return (
    <div className="ov" role="dialog" aria-modal onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <header className="hd">
          <div className="left">
            <div className="tt">{recipe.title}</div>
            <div className="meta">
              {recipe.area ? <span className="pill">{recipe.area}</span> : null}
              {recipe.category ? <span className="pill">{recipe.category}</span> : null}
              <span className="pill src">{recipe.source === "api" ? "API" : "My recipe"}</span>
            </div>
          </div>
          <div className="right">
            <button
              className={`fav ${isFavorite ? "on" : ""}`}
              onClick={() => onToggleFavorite(recipe)}
              aria-pressed={isFavorite}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              type="button"
            >
              {isFavorite ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button className="x" onClick={onClose} aria-label="Close" type="button">✕</button>
          </div>
        </header>

        {recipe.image ? (
          <div className="imgWrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="img" src={recipe.image} alt={recipe.title} />
          </div>
        ) : null}

        <section className="sec">
          <h3 className="h">Ingredients</h3>
          {ingredients.length ? (
            <ul className="list">
              {ingredients.map((ing, i) => (
                <ItemRow key={`${ing.name}-${i}`} name={ing.name || ""} measure={ing.measure || ""} />
              ))}
            </ul>
          ) : (
            <p className="muted">No ingredients provided.</p>
          )}
        </section>

        <section className="sec">
          <h3 className="h">Instructions</h3>
          {steps.length ? (
            <ol className="steps">
              {steps.map((s, i) => <li key={i} className="step">{s}</li>)}
            </ol>
          ) : (
            <p className="muted">No instructions provided.</p>
          )}
        </section>
      </div>

      <style jsx>{`
        .ov{position:fixed; inset:0; background:rgba(2,6,23,.55); display:grid; place-items:center; padding:16px; z-index:1600}
        .box{width:100%; max-width:900px; max-height:90vh; overflow:auto; background:var(--card-bg);
             border:1px solid var(--border); border-radius:16px; box-shadow:0 24px 80px rgba(2,6,23,.25)}
        .hd{display:flex; align-items:center; justify-content:space-between; padding:12px 14px;
            border-bottom:1px solid var(--border); background:color-mix(in oklab, var(--card-bg) 92%, #fff)}
        .tt{font-weight:800; font-size:20px; color:var(--text)}
        .meta{display:flex; gap:6px; margin-top:4px}
        .pill{border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:12px; color:var(--muted)}
        .pill.src{background:var(--bg2)}
        .right{display:flex; gap:8px; align-items:center}
        .x{border:none; background:var(--bg2); color:var(--text); border-radius:10px; padding:6px 10px; cursor:pointer}
        .fav{border:1px solid var(--border); background:var(--bg2); color:var(--text); border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:700}
        .fav.on{background:#fde68a; border-color:#f59e0b}
        .imgWrap{width:100%; aspect-ratio: 16/7; background:#f1f5f9; overflow:hidden}
        .img{width:100%; height:100%; object-fit:cover}
        .sec{padding:12px 14px; border-top:1px solid var(--border)}
        .h{margin:0 0 8px; color:var(--text)}
        .list{list-style:none; margin:0; padding:0}
        .steps{margin:0; padding-left:20px}
        .step{padding:6px 0; border-bottom:1px dashed var(--border)}
        .muted{color:var(--muted)}
      `}</style>
    </div>
  );
}
