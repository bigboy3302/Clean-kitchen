"use client";

import React from "react";
import { useEffect, useState } from "react";

type Recipe = {
  id: string;
  title: string;
  image?: string | null;
  url?: string | null;
  servings?: number | null;
  readyInMinutes?: number | null;
  calories?: number | null;
  instructionsHtml?: string | null;
  ingredients?: Array<{ name: string; amount?: string | number; unit?: string }>;
};

type Props = {
  id: string;
  onClose: () => void;
};

const RecipeModal: React.FC<Props> = ({ id, onClose }) => {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`/api/recipes/enrich?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Recipe not found");
        const data = (await res.json()) as Recipe | { error?: string };
        if (!ignore) {
          if ((data as any)?.error) throw new Error("Recipe not found");
          setRecipe(data as Recipe);
        }
      } catch (e: any) {
        if (!ignore) setErr(e?.message || "Failed to load recipe.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Recipe details">
      <div className="panel">
        <button className="close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {loading ? (
          <div className="muted">Loading…</div>
        ) : err ? (
          <div className="error">{err}</div>
        ) : recipe ? (
          <article className="wrap">
            <header className="head">
              <h2 className="title">{recipe.title}</h2>
              <div className="meta">
                {recipe.readyInMinutes ? <span>⏱ {recipe.readyInMinutes}m</span> : null}
                {recipe.servings ? <span>🍽 {recipe.servings} servings</span> : null}
                {recipe.calories ? <span>🔥 {Math.round(recipe.calories)} kcal</span> : null}
              </div>
            </header>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image || "/placeholder.png"}
              alt={recipe.title}
              className="hero"
              loading="lazy"
            />

            <div className="grid">
              {recipe.ingredients?.length ? (
                <div className="block">
                  <h3 className="h3">Ingredients</h3>
                  <ul className="list">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i}>
                        {ing.amount ? <strong>{ing.amount}</strong> : null}{" "}
                        {ing.unit ? <em>{ing.unit}</em> : null} {ing.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {recipe.instructionsHtml ? (
                <div className="block">
                  <h3 className="h3">Preparation</h3>
                  <div
                    className="prose"
                    dangerouslySetInnerHTML={{ __html: recipe.instructionsHtml }}
                  />
                </div>
              ) : null}
            </div>

            {recipe.url ? (
              <a className="btn" href={recipe.url} target="_blank" rel="noopener noreferrer">
                Open source recipe →
              </a>
            ) : null}
          </article>
        ) : null}
      </div>

      <style jsx>{`
        .sheet{position:fixed;inset:0;background:color-mix(in oklab,#000 55%, transparent);display:flex;justify-content:center;align-items:flex-end;z-index:60}
        @media (min-width:640px){ .sheet{align-items:center;padding:20px} }
        .panel{position:relative;width:100%;max-width:720px;background:var(--card-bg);border-radius:18px 18px 0 0;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:14px;border:1px solid var(--border)}
        @media (min-width:640px){ .panel{border-radius:18px;padding:18px} }
        .close{border:none;background:transparent;font-size:18px;line-height:1;padding:6px 8px;border-radius:10px;position:absolute;right:14px;top:10px;color:var(--text);cursor:pointer}
        .wrap{display:flex;flex-direction:column;gap:12px}
        .head{display:flex;flex-direction:column;gap:6px}
        .title{margin:0;font-size:20px;font-weight:900;color:var(--text)}
        .meta{display:flex;gap:10px;color:var(--muted);flex-wrap:wrap}
        .hero{width:100%;border-radius:12px;border:1px solid var(--border);object-fit:cover;max-height:300px}
        .grid{display:grid;grid-template-columns:1fr;gap:12px}
        @media (min-width:720px){ .grid{grid-template-columns:1fr 1fr} }
        .block{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--bg2)}
        .h3{margin:0 0 8px;font-size:16px;font-weight:800}
        .list{margin:0;padding-left:18px;display:grid;gap:6px}
        .prose :global(p){margin:0 0 8px;line-height:1.6}
        .btn{display:inline-block;border:1px solid var(--border);background:var(--primary);color:var(--primary-contrast);border-radius:999px;padding:8px 14px;font-weight:800;text-decoration:none}
      `}</style>
    </div>
  );
};

export default RecipeModal;
