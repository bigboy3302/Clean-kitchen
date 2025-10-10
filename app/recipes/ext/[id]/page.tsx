"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type Recipe = {
  id: string;
  title: string;
  image?: string | null;
  url?: string | null;
  servings?: number | null;
  readyInMinutes?: number | null;
  calories?: number | null;
  instructionsHtml?: string | null;
  ingredients?: Array<{ name: string; amount?: string | number; unit?: string }> | null;
};

export default function ExternalRecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const backHref = useMemo(() => {
    return search.get("back") || "/fitness/day";
  }, [search]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`/api/recipes/enrich?id=${encodeURIComponent(String(id))}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!ignore) {
            setRecipe(null);
            setErr("This recipe doesn’t exist (or was deleted).");
          }
          return;
        }
        const data = (await res.json()) as Recipe | { error?: string };
        if ((data as any)?.error) {
          if (!ignore) {
            setRecipe(null);
            setErr("This recipe doesn’t exist (or was deleted).");
          }
          return;
        }
        if (!ignore) setRecipe(data as Recipe);
      } catch (e: any) {
        if (!ignore) setErr(e?.message || "Failed to load recipe.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    if (id) run();
    return () => {
      ignore = true;
    };
  }, [id]);

  function goBack() {
 
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(backHref);
  }

  return (
    <main className="wrap">

      {loading ? (
        <div className="card skelly">
          <div className="sk-title" />
          <div className="sk-hero" />
          <div className="sk-row" />
          <div className="sk-row" />
        </div>
      ) : err ? (
        <div className="card bad">
          <p className="err">{err}</p>
          <div className="row">
            <button className="btn" onClick={goBack}>← Back to plan</button>
          </div>
        </div>
      ) : recipe ? (
        <article className="recipe">
          {/* Title & chips */}
          <header className="head">
            <h1 className="title">{recipe.title}</h1>
            <div className="chips">
              {recipe.readyInMinutes ? <span className="chip">⏱ {recipe.readyInMinutes}m</span> : null}
              {recipe.servings ? <span className="chip">🍽 {recipe.servings} servings</span> : null}
              {recipe.calories ? <span className="chip">🔥 {recipe.calories} kcal</span> : null}
            </div>
          </header>

          {/* Media */}
          <div className="hero">
            <Image
              src={recipe.image || "/placeholder.png"}
              alt={recipe.title}
              width={1600}
              height={1000}
              className="img"
              priority
            />
          </div>

          {/* Actions (desktop/tablet) */}
          <div className="actions">
            <button className="btn" onClick={goBack}>← Back to plan</button>
            {recipe.url ? (
              <a className="btn primary" href={recipe.url} target="_blank" rel="noopener noreferrer">
                Open source recipe
              </a>
            ) : null}
          </div>

          {/* Content */}
          <section className="grid">
            {recipe.ingredients?.length ? (
              <div className="block">
                <h2 className="h2">Ingredients</h2>
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
                <h2 className="h2">Instructions</h2>
                <div
                  className="prose"
                  dangerouslySetInnerHTML={{ __html: recipe.instructionsHtml }}
                />
              </div>
            ) : null}
          </section>

          {/* Sticky bottom actions (mobile) */}
          <div className="fabBar" role="region" aria-label="Recipe actions">
            {recipe.url ? (
              <a className="btn primary" href={recipe.url} target="_blank" rel="noopener noreferrer">
                Open source
              </a>
            ) : null}
          </div>
        </article>
      ) : (
        <div className="card bad">This recipe doesn’t exist (or was deleted).</div>
      )}

      <style jsx>{`
        .wrap {
          max-width: 1000px;
          margin: 0 auto;
          padding: 70px 14px 96px; /* room for sticky bars */
        }

        /* Top app bar */
        .topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          background: color-mix(in oklab, var(--card-bg) 88%, transparent);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border);
          margin: -10px -12px 14px; /* cancel main padding at top */
        }
        .backBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          border-radius: 999px;
          padding: 6px 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .backText { display: inline-block; }
        .backLink {
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          border-radius: 999px;
          padding: 6px 12px;
          font-weight: 700;
          text-decoration: none;
        }

        /* Skeleton */
        .skelly { display: grid; gap: 12px; }
        .sk-title { height: 28px; background: var(--bg2); border-radius: 10px; }
        .sk-hero { height: 280px; background: var(--bg2); border-radius: 16px; }
        .sk-row { height: 16px; background: var(--bg2); border-radius: 8px; }

        .card {
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 16px;
          padding: 14px;
        }
        .bad {
          background: color-mix(in oklab, #ef4444 15%, var(--card-bg));
          border-color: color-mix(in oklab, #ef4444 35%, var(--border));
          color: #7f1d1d;
        }
        .err { margin: 0 0 10px; }

        .recipe { display: grid; gap: 16px; }
        .head { display: grid; gap: 6px; }
        .title {
          margin: 0;
          font-size: clamp(22px, 2.2vw + 14px, 32px);
          font-weight: 900;
          color: var(--text);
          line-height: 1.15;
        }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip {
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
        }

        .hero {
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          background: #000;
          /* maintain nice aspect on mobile */
          aspect-ratio: 16 / 9;
        }
        .img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .btn {
          border-radius: 999px;
          padding: 9px 14px;
          font-weight: 800;
          text-decoration: none;
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          cursor: pointer;
        }
        .btn.primary {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: var(--primary);
        }
        .btn.ghost {
          background: transparent;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 880px) {
          .grid { grid-template-columns: 1fr; }
        }

        .block {
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 16px;
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .h2 {
          margin: 0;
          font-size: 18px;
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
          margin: 0 0 10px;
          color: var(--text);
          line-height: 1.7;
        }
        .prose :global(ol), .prose :global(ul) {
          padding-left: 20px;
          margin: 0 0 10px;
        }

        /* Sticky bottom action bar for mobile */
        .fabBar {
          position: sticky;
          bottom: -1px;
          margin: 8px -6px -8px;
          padding: 10px 8px;
          display: none;
          gap: 10px;
          justify-content: space-between;
          align-items: center;
          background: color-mix(in oklab, var(--card-bg) 92%, transparent);
          border-top: 1px solid var(--border);
          backdrop-filter: blur(10px);
          z-index: 40;
        }
        @media (max-width: 640px) {
          .fabBar { display: flex; }
          .actions { display: none; }
          .backText { display: none; } /* tighten the top-button on very small screens */
        }

        .row { display: flex; gap: 8px; }
      `}</style>
    </main>
  );
}
