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
        value != null
          ? `${(value * factor).toFixed(value % 1 === 0 ? 0 : 2)} ${unit}`.trim()
          : (i.measure || "");
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
            >
              ★
            </button>
            <button className="x" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {/* === Hero with zoom + gradient + over-image chips === */}
        {recipe.image ? (
          <div className="heroWrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero" src={recipe.image} alt={recipe.title} />
            <div className="heroGrad" aria-hidden="true" />
            <div className="chipsRow">
              <div className="chipsLeft">
                {recipe.category ? <span className="chip">{recipe.category}</span> : null}
                {recipe.area ? <span className="chip">{recipe.area}</span> : null}
              </div>
              <span className="source">
                {recipe.source === "user"
                  ? `by ${recipe.author?.name ?? recipe.author?.uid?.slice(0, 6) ?? "User"}`
                  : "from TheMealDB"}
              </span>
            </div>
          </div>
        ) : (
          // Fallback (no image): keep a simple row
          <div className="row">
            {recipe.category ? <span className="chip alt">{recipe.category}</span> : null}
            {recipe.area ? <span className="chip alt">{recipe.area}</span> : null}
            <span className="muted" style={{ marginLeft: "auto" }}>
              {recipe.source === "user"
                ? `by ${recipe.author?.name ?? recipe.author?.uid?.slice(0, 6) ?? "User"}`
                : "from TheMealDB"}
            </span>
          </div>
        )}

        <div className="servings">
          <label>Servings</label>
          <input
            className="num"
            type="number"
            min={1}
            value={String(servings)}
            onChange={(e) =>
              setServings(Math.max(1, Number(e.currentTarget.value) || 1))
            }
          />
        </div>

        <div className="cols">
          <section className="panel">
            <h4>Ingredients</h4>
            <ul className="ing">
              {items.map((i, idx) => (
                <li key={idx}>
                  <strong>{i.name}</strong>
                  {i.measure ? ` — ${i.measure}` : ""}
                </li>
              ))}
            </ul>
          </section>

          {recipe.instructions ? (
            <section className="panel">
              <h4>Instructions</h4>
              <p className="inst">{recipe.instructions}</p>
            </section>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        /* Backdrop */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.6);
          display: grid;
          place-items: center;
          padding: 16px;
        }

        /* Card container (theme-aware) */
        .modal {
          width: 100%;
          max-width: 920px;
          max-height: 92vh;
          overflow: auto;
          background: var(--card-bg, #fff);
          border-radius: 16px;
          border: 1px solid var(--border, #e5e7eb);
          color: var(--text, #0f172a);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .modal:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 46px rgba(0, 0, 0, 0.18);
        }

        /* Header */
        .head {
          position: sticky;
          top: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 14px 16px;
          background: color-mix(in oklab, var(--card-bg) 85%, #ffffff);
          border-bottom: 1px solid var(--border, #eef2f7);
          backdrop-filter: blur(6px);
        }
        .title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: var(--text, #0f172a);
        }
        .right {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .x {
          border: none;
          background: var(--text, #0f172a);
          color: var(--primary-contrast, #fff);
          border-radius: 10px;
          padding: 4px 10px;
          cursor: pointer;
        }
        .x:hover {
          filter: brightness(1.05);
        }
        .star {
          border: 1px solid var(--border, #e5e7eb);
          background: var(--bg2, #fff);
          border-radius: 999px;
          padding: 4px 8px;
          cursor: pointer;
          transition: 0.15s transform, 0.2s background, 0.2s border-color;
        }
        .star:hover {
          transform: scale(1.06);
          background: color-mix(in oklab, var(--primary) 14%, var(--bg2));
          border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
        }
        .star.on {
          background: #fde68a;
          border-color: #f59e0b;
        }

        /* HERO: zoom + gradient + chips on image */
        .heroWrap {
          position: relative;
          overflow: hidden;
          height: 320px;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .hero {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: scale(1);
          transition: transform 0.7s ease;
        }
        .modal:hover .hero {
          transform: scale(1.08);
        }
        .heroGrad {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.06),
            rgba(0, 0, 0, 0.28) 45%,
            rgba(0, 0, 0, 0.6)
          );
        }
        .chipsRow {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chipsLeft {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .chip {
          background: var(--primary, #2563eb);
          color: var(--primary-contrast, #fff);
          border: 1px solid rgba(0, 0, 0, 0.12);
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          white-space: nowrap;
        }
        .chip.alt {
          background: #f1f5f9;
          color: #0f172a;
          border: 1px solid var(--border, #e2e8f0);
          box-shadow: none;
        }
        .source {
          margin-left: auto;
          font-size: 12px;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        }

        /* (no image) fallback row */
        .row {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 10px 16px 0;
          color: var(--muted, #64748b);
        }

        /* Servings */
        .servings {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
        }
        .num {
          width: 90px;
          border: 1px solid var(--border, #d1d5db);
          border-radius: 10px;
          padding: 6px 10px;
          background: var(--bg2, #fff);
          color: var(--text, #0f172a);
        }

        /* Content panels */
        .cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 0 16px 16px;
        }
        @media (max-width: 820px) {
          .cols {
            grid-template-columns: 1fr;
          }
        }
        h4 {
          margin: 10px 0 6px;
          color: var(--text, #0f172a);
          font-weight: 800;
        }
        .panel {
          background: var(--bg2, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
        }
        .ing {
          margin: 0;
          padding-left: 18px;
        }
        .inst {
          white-space: pre-wrap;
          margin: 0;
          color: var(--text, #0f172a);
        }
      `}</style>
    </div>
  );
}
