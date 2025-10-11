"use client";

import React, { useEffect, useState } from "react";

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

type CommonRecipe = {
  id: string;
  title: string;
  image?: string | null;
  instructions?: string | null;
  minutes?: number | null;
  servings?: number | null;
  ingredients?: Array<{ name: string; measure?: string | null }>;
  url?: string | null;
};

type Props = {
  id: string;
  onClose: () => void;
};

const ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (char) => ESCAPE_LOOKUP[char] || char);
}

function paragraphsToHtml(raw?: string | null) {
  if (!raw) return null;
  const parts = raw
    .split(/\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return parts.map((part) => `<p>${escapeHtml(part)}</p>`).join("");
}

async function fetchPrimaryRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`/api/recipes/enrich?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(text || "Recipe not found");
  }
  const data = (await res.json()) as Recipe & { error?: string };
  if ((data as any)?.error) throw new Error((data as any).error || "Recipe not found");
  return data;
}

async function fetchFallbackRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`/api/recipes?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Recipe not found");
  }
  const json = (await res.json()) as { ok?: boolean; error?: string; recipes?: CommonRecipe[] };
  if (json?.error) throw new Error(json.error);
  const first = Array.isArray(json?.recipes) ? json.recipes[0] : null;
  if (!first) throw new Error("Recipe not found");
  return {
    id: first.id,
    title: first.title,
    image: first.image || null,
    url: first.url || null,
    servings: first.servings ?? null,
    readyInMinutes: first.minutes ?? null,
    calories: null,
    ingredients:
      (first.ingredients || []).map((ing) => ({
        name: ing.name,
        amount: ing.measure || null,
        unit: undefined,
      })) || [],
    instructionsHtml: paragraphsToHtml(first.instructions),
  };
}

const RecipeModal: React.FC<Props> = ({ id, onClose }) => {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setRecipe(null);
        try {
          const primary = await fetchPrimaryRecipe(id);
          if (!ignore) {
            setRecipe(primary);
            return;
          }
        } catch (primaryError) {
          try {
            const fallback = await fetchFallbackRecipe(id);
            if (!ignore) {
              setRecipe(fallback);
              return;
            }
          } catch (fallbackError: any) {
            if (!ignore) {
              setErr(fallbackError?.message || (primaryError as any)?.message || "Failed to load recipe.");
            }
          }
        }
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
          X
        </button>

        {loading ? (
          <div className="muted">Loading...</div>
        ) : err ? (
          <div className="error">{err}</div>
        ) : recipe ? (
          <article className="wrap">
            <header className="head">
              <h2 className="title">{recipe.title}</h2>
              <div className="meta">
                {recipe.readyInMinutes ? <span>Time {recipe.readyInMinutes}m</span> : null}
                {recipe.servings ? <span>Serves {recipe.servings}</span> : null}
                {recipe.calories ? <span>{Math.round(recipe.calories)} kcal</span> : null}
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
                Open source recipe ->
              </a>
            ) : null}
          </article>
        ) : null}
      </div>

      <style jsx>{`
        .sheet {
          position: fixed;
          inset: 0;
          background: color-mix(in oklab, #000 55%, transparent);
          display: flex;
          justify-content: center;
          align-items: flex-end;
          padding: 16px;
          z-index: 60;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        @media (min-width: 640px) {
          .sheet {
            align-items: center;
            padding: 24px;
          }
        }
        .panel {
          position: relative;
          width: 100%;
          max-width: 720px;
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          background: var(--card-bg);
          border-radius: 18px 18px 0 0;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
          padding: 18px;
          border: 1px solid var(--border);
          scrollbar-gutter: stable;
        }
        @media (min-width: 640px) {
          .panel {
            border-radius: 18px;
            max-height: calc(100vh - 60px);
          }
        }
        .panel::-webkit-scrollbar {
          width: 8px;
        }
        .panel::-webkit-scrollbar-thumb {
          background: color-mix(in oklab, var(--border) 75%, var(--primary) 25%);
          border-radius: 999px;
        }
        .close {
          border: none;
          background: transparent;
          font-size: 18px;
          line-height: 1;
          padding: 6px 8px;
          border-radius: 10px;
          position: absolute;
          right: 14px;
          top: 10px;
          color: var(--text);
          cursor: pointer;
        }
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .head {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .title {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
          color: var(--text);
        }
        .meta {
          display: flex;
          gap: 10px;
          color: var(--muted);
          flex-wrap: wrap;
        }
        .hero {
          width: 100%;
          border-radius: 14px;
          border: 1px solid var(--border);
          object-fit: cover;
          max-height: 320px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 720px) {
          .grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .block {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          background: var(--bg2);
          display: grid;
          gap: 10px;
        }
        .h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
        }
        .list {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 6px;
        }
        .prose :global(p) {
          margin: 0 0 8px;
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          border: 1px solid var(--border);
          background: var(--primary);
          color: var(--primary-contrast);
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 800;
          text-decoration: none;
          width: fit-content;
        }
        .muted {
          color: var(--muted);
        }
        .error {
          background: color-mix(in oklab, #ef4444 16%, var(--card-bg));
          border: 1px solid color-mix(in oklab, #ef4444 36%, var(--border));
          color: #7f1d1d;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
};

export default RecipeModal;
