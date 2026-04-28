"use client";

import React, { useEffect, useMemo } from "react";
import { getRecipePlaceholder } from "./RecipeCard";
import type { CommonRecipe, Ingredient } from "./types";

type Props = {
  recipe: CommonRecipe;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (r: CommonRecipe) => void | Promise<void>;
};

function splitInstructions(value?: string | null) {
  return String(value || "")
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function getMetaNumber(recipe: CommonRecipe, key: string) {
  const value = (recipe as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ItemRow({ name, measure }: Ingredient) {
  return (
    <li className="ingredientRow">
      <span className="ingredientDot" aria-hidden="true" />
      <div className="ingredientCopy">
        <span className="ingredientName">{name}</span>
        {measure ? <span className="ingredientMeasure">{measure}</span> : null}
      </div>
      <style jsx>{`
        .ingredientRow {
          display: grid;
          grid-template-columns: 10px 1fr;
          gap: 12px;
          align-items: start;
          padding: 12px 0;
          border-bottom: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
        }
        .ingredientDot {
          width: 10px;
          height: 10px;
          margin-top: 7px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 30% 30%, #fff8d4 0%, #f6d365 35%, #e6a800 100%);
          box-shadow: 0 0 0 4px color-mix(in oklab, #f6d365 18%, transparent);
        }
        .ingredientCopy {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .ingredientName {
          color: var(--text);
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .ingredientMeasure {
          color: var(--muted);
          font-size: 0.92rem;
        }
      `}</style>
    </li>
  );
}

export default function RecipeModal({
  recipe,
  isFavorite = false,
  onToggleFavorite,
  onClose,
}: Props) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = useMemo(() => splitInstructions(recipe.instructions), [recipe.instructions]);
  const canFavorite = typeof onToggleFavorite === "function";
  const image = recipe.image || getRecipePlaceholder(recipe.title);
  const minutes = getMetaNumber(recipe, "minutes") ?? getMetaNumber(recipe, "timeMinutes");
  const servings = getMetaNumber(recipe, "servings");
  const calories = getMetaNumber(recipe, "calories");
  const sourceLabel = recipe.source === "user" ? "My Recipe" : "Recipe Library";
  const metaSummary = [recipe.area, recipe.category].filter(Boolean).join(" • ");
  const authorName = recipe.author?.name?.trim() || null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={recipe.title} onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="closeButton" onClick={onClose} aria-label="Close recipe" type="button">
          <span aria-hidden="true">×</span>
        </button>

        <section className="hero">
          <div className="coverCard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="coverImage" src={image} alt={recipe.title} />
          </div>

          <div className="headCard">
            <div className="heroTop">
              <div className="eyebrow">Clean Kitchen Recipe</div>
              {canFavorite ? (
                <button
                  className={`favoriteButton ${isFavorite ? "isActive" : ""}`}
                  onClick={() => onToggleFavorite?.(recipe)}
                  aria-pressed={isFavorite}
                  type="button"
                >
                  <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
                  <span>{isFavorite ? "Saved" : "Save"}</span>
                </button>
              ) : null}
            </div>

            <div className="titleWrap">
              <h2>{recipe.title}</h2>
              {metaSummary || authorName ? (
                <p className="heroSummary">
                  {metaSummary || sourceLabel}
                  {authorName ? ` • by ${authorName}` : ""}
                </p>
              ) : null}
            </div>

            <div className="metaRow">
              <div className="badges">
                <span className="badge badgeSource">{sourceLabel}</span>
                {recipe.category ? <span className="badge">{recipe.category}</span> : null}
                {recipe.area ? <span className="badge">{recipe.area}</span> : null}
              </div>
            </div>

            <div className="metrics">
              {typeof minutes === "number" ? <span className="metricPill">{minutes} min</span> : null}
              {typeof servings === "number" ? <span className="metricPill">{servings} servings</span> : null}
              {typeof calories === "number" ? <span className="metricPill">{calories} cal</span> : null}
              {recipe.vegetarian ? <span className="metricPill">Vegetarian</span> : null}
              {recipe.vegan ? <span className="metricPill">Vegan</span> : null}
              <span className="metricPill">{ingredients.length} ingredients</span>
            </div>
          </div>
        </section>

        <div className="content">
          <aside className="ingredientsPanel">
            <div className="sectionLabel">Shopping List</div>
            <h3>Ingredients</h3>
            {ingredients.length ? (
              <ul className="ingredientList">
                {ingredients.map((ingredient, index) => (
                  <ItemRow
                    key={`${ingredient.name}-${index}`}
                    name={ingredient.name || ""}
                    measure={ingredient.measure || ""}
                  />
                ))}
              </ul>
            ) : (
              <p className="muted">No ingredients provided.</p>
            )}
          </aside>

          <section className="instructionsPanel">
            <div className="sectionLabel">Method</div>
            <h3>Preparation</h3>
            {steps.length ? (
              <ol className="stepList">
                {steps.map((step, index) => (
                  <li key={`${index}-${step.slice(0, 16)}`} className="stepCard">
                    <span className="stepIndex">{String(index + 1).padStart(2, "0")}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No instructions provided.</p>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 1800;
          padding: 24px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at top, color-mix(in oklab, var(--primary) 18%, transparent), transparent 30%),
            linear-gradient(180deg, color-mix(in oklab, var(--text) 56%, transparent), color-mix(in oklab, var(--text) 72%, transparent));
          backdrop-filter: blur(18px) saturate(1.08);
        }
        .modal {
          position: relative;
          width: min(1120px, 100%);
          max-height: min(92vh, 980px);
          overflow: auto;
          border-radius: 30px;
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 10%, transparent), transparent 34%),
            linear-gradient(180deg, color-mix(in oklab, var(--bg-raised) 96%, white 4%) 0%, color-mix(in oklab, var(--bg) 93%, var(--bg-raised) 7%) 100%);
          border: 1px solid color-mix(in oklab, var(--border) 72%, rgba(255,255,255,0.22));
          box-shadow:
            0 34px 100px rgba(2, 6, 23, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .closeButton {
          position: sticky;
          top: 14px;
          margin-left: auto;
          right: 18px;
          z-index: 20;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid color-mix(in oklab, var(--border) 40%, rgba(255,255,255,0.28));
          border-radius: 999px;
          background: color-mix(in oklab, var(--bg) 54%, rgba(12,18,28,0.55));
          color: var(--text);
          backdrop-filter: blur(12px);
          cursor: pointer;
          transform: translate(-18px, 18px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
        }
        .closeButton span {
          font-size: 1.5rem;
          line-height: 1;
        }
        .hero {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 14px;
          padding: 18px 18px 0;
          align-items: stretch;
        }
        .coverCard,
        .headCard {
          border-radius: var(--radius-card, 22px);
          border: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
          overflow: hidden;
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 8%, transparent), transparent 40%),
            color-mix(in oklab, var(--bg-raised) 96%, white 4%);
          box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08);
        }
        .coverCard {
          aspect-ratio: 16 / 10;
          position: relative;
          min-height: 260px;
          background: var(--bg2);
        }
        .coverImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .headCard {
          padding: 22px;
          display: grid;
          gap: 14px;
          align-content: start;
        }
        .heroTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .metaRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .badge {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
          background: color-mix(in oklab, var(--bg) 78%, var(--primary) 22% / 16%);
          border: 1px solid var(--border);
        }
        .badgeSource {
          background: color-mix(in oklab, var(--primary) 16%, transparent);
          color: var(--primary);
          border-color: color-mix(in oklab, var(--primary) 32%, transparent);
        }
        .favoriteButton {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 10px 14px;
          background: var(--bg2);
          color: var(--text);
          cursor: pointer;
          font-weight: 800;
          flex-shrink: 0;
        }
        .favoriteButton.isActive {
          background: color-mix(in oklab, var(--primary) 18%, transparent);
          color: var(--primary);
          border-color: color-mix(in oklab, var(--primary) 32%, transparent);
        }
        .eyebrow {
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
        }
        .titleWrap {
          display: grid;
          gap: 10px;
        }
        .heroBody h2 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(24px, 3.4vw, 32px);
          line-height: 0.96;
          letter-spacing: -0.04em;
          color: var(--text);
        }
        .heroSummary {
          margin: 0;
          color: var(--muted);
          line-height: 1.65;
          font-size: 0.96rem;
        }
        .metrics {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .metricPill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
          border: 1px solid var(--border);
          background: var(--bg2);
        }
        .content {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 14px;
          padding: 14px 18px 18px;
        }
        .ingredientsPanel,
        .instructionsPanel {
          padding: 22px;
          border: 1px solid var(--border);
          border-radius: var(--radius-card, 22px);
          background: var(--card-bg, var(--bg-raised));
          box-shadow: var(--shadow, 0 8px 20px rgba(15, 23, 42, 0.08));
        }
        .ingredientsPanel {
          position: sticky;
          top: 14px;
        }
        .sectionLabel {
          display: none;
        }
        h3 {
          margin: 0 0 14px;
          color: var(--text);
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.01em;
          font-family: inherit;
        }
        .ingredientList,
        .stepList {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .stepList {
          display: grid;
          gap: 14px;
        }
        .stepCard {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
          padding: 0;
          border-radius: 0;
          background: transparent;
          border: 0;
          box-shadow: none;
        }
        .stepIndex {
          display: inline-grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          font-size: 0.9rem;
          font-weight: 800;
        }
        .stepCard p {
          margin: 0;
          color: var(--text);
          line-height: 1.65;
          font-size: 0.96rem;
        }
        .muted {
          margin: 0;
          color: var(--muted);
          line-height: 1.65;
        }

        @media (max-width: 900px) {
          .overlay {
            padding: 14px;
          }
          .modal {
            border-radius: 24px;
          }
          .hero {
            grid-template-columns: 1fr;
            padding: 14px 14px 0;
          }
          .content {
            grid-template-columns: 1fr;
            padding: 14px;
          }
          .ingredientsPanel {
            position: relative;
            top: auto;
          }
        }

        @media (max-width: 640px) {
          .overlay {
            padding: 0;
            align-items: end;
          }
          .modal {
            width: 100%;
            max-height: 100dvh;
            border-radius: 28px 28px 0 0;
          }
          .closeButton {
            top: 10px;
            width: 40px;
            height: 40px;
            transform: translate(-12px, 12px);
          }
          .hero {
            padding: 12px 12px 0;
          }
          .heroTop {
            align-items: flex-start;
            flex-direction: column;
          }
          .headCard {
            padding: 16px;
          }
          .heroSummary {
            font-size: 0.92rem;
          }
          .content {
            padding: 12px;
          }
          .ingredientsPanel,
          .instructionsPanel {
            padding: 18px 16px 22px;
          }
          .stepCard {
            grid-template-columns: 28px 1fr;
          }
        }
      `}</style>
    </div>
  );
}
