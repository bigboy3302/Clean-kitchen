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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="heroImage" src={image} alt={recipe.title} />
          <div className="heroShade" />

          <div className="heroTop">
            <div className="badges">
              {recipe.area ? <span className="badge">{recipe.area}</span> : null}
              {recipe.category ? <span className="badge">{recipe.category}</span> : null}
              <span className="badge badgeSource">{recipe.source === "user" ? "My Recipe" : "Recipe Library"}</span>
            </div>

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

          <div className="heroBody">
            <div className="eyebrow">Clean Kitchen Recipe</div>
            <h2>{recipe.title}</h2>

            <div className="metrics">
              {typeof minutes === "number" ? (
                <div className="metricCard">
                  <strong>{minutes}</strong>
                  <span>Minutes</span>
                </div>
              ) : null}
              {typeof servings === "number" ? (
                <div className="metricCard">
                  <strong>{servings}</strong>
                  <span>Servings</span>
                </div>
              ) : null}
              {typeof calories === "number" ? (
                <div className="metricCard">
                  <strong>{calories}</strong>
                  <span>Calories</span>
                </div>
              ) : null}
              {recipe.vegetarian ? (
                <div className="metricCard metricTag">
                  <strong>Veg</strong>
                  <span>Vegetarian</span>
                </div>
              ) : null}
              {recipe.vegan ? (
                <div className="metricCard metricTag">
                  <strong>V+</strong>
                  <span>Vegan</span>
                </div>
              ) : null}
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
            radial-gradient(circle at top, rgba(255, 217, 102, 0.16), transparent 28%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(15, 23, 42, 0.88));
          backdrop-filter: blur(14px);
        }
        .modal {
          position: relative;
          width: min(1120px, 100%);
          max-height: min(92vh, 980px);
          overflow: auto;
          border-radius: 30px;
          background:
            linear-gradient(180deg, color-mix(in oklab, var(--bg2) 92%, #fff4d6) 0%, var(--bg2) 52%, color-mix(in oklab, var(--bg) 92%, #ffffff) 100%);
          border: 1px solid color-mix(in oklab, var(--border) 80%, rgba(255,255,255,0.24));
          box-shadow:
            0 32px 90px rgba(2, 6, 23, 0.42),
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
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 999px;
          background: rgba(12, 18, 28, 0.58);
          color: white;
          backdrop-filter: blur(12px);
          cursor: pointer;
          transform: translate(-18px, 18px);
        }
        .closeButton span {
          font-size: 1.5rem;
          line-height: 1;
        }
        .hero {
          position: relative;
          min-height: 360px;
          padding: 22px 26px 26px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: 30px 30px 0 0;
          overflow: hidden;
          background: #2b2118;
        }
        .heroImage,
        .heroShade {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .heroImage {
          object-fit: cover;
        }
        .heroShade {
          background:
            linear-gradient(180deg, rgba(14, 20, 30, 0.2) 0%, rgba(14, 20, 30, 0.42) 32%, rgba(14, 20, 30, 0.82) 100%),
            linear-gradient(120deg, rgba(245, 158, 11, 0.25), transparent 46%);
        }
        .heroTop,
        .heroBody {
          position: relative;
          z-index: 1;
        }
        .heroTop {
          display: flex;
          gap: 16px;
          justify-content: space-between;
          align-items: flex-start;
        }
        .badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding-right: 16px;
        }
        .badge {
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 248, 235, 0.96);
          background: rgba(255, 255, 255, 0.13);
          border: 1px solid rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(12px);
        }
        .badgeSource {
          background: rgba(246, 211, 101, 0.18);
          color: #fff3c2;
        }
        .favoriteButton {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(12, 18, 28, 0.4);
          color: white;
          cursor: pointer;
          font-weight: 700;
          backdrop-filter: blur(12px);
          flex-shrink: 0;
        }
        .favoriteButton.isActive {
          background: rgba(246, 211, 101, 0.22);
          color: #fff2b2;
          border-color: rgba(246, 211, 101, 0.38);
        }
        .eyebrow {
          margin-bottom: 10px;
          color: rgba(255, 236, 210, 0.9);
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .heroBody h2 {
          margin: 0;
          max-width: 760px;
          font-size: clamp(2rem, 4vw, 3.35rem);
          line-height: 0.96;
          letter-spacing: -0.04em;
          color: white;
          text-wrap: balance;
        }
        .metrics {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
        }
        .metricCard {
          min-width: 112px;
          padding: 12px 14px;
          border-radius: 18px;
          background: rgba(255, 248, 237, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.14);
          backdrop-filter: blur(14px);
          color: white;
        }
        .metricCard strong {
          display: block;
          font-size: 1.1rem;
          letter-spacing: -0.03em;
        }
        .metricCard span {
          display: block;
          margin-top: 4px;
          font-size: 0.78rem;
          color: rgba(255, 239, 216, 0.82);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .metricTag strong {
          font-size: 0.98rem;
        }
        .content {
          display: grid;
          grid-template-columns: minmax(290px, 0.95fr) minmax(0, 1.45fr);
          gap: 0;
        }
        .ingredientsPanel,
        .instructionsPanel {
          padding: 28px 28px 32px;
        }
        .ingredientsPanel {
          background:
            linear-gradient(180deg, color-mix(in oklab, #fff4d6 55%, var(--bg2)) 0%, color-mix(in oklab, #fffaf2 92%, var(--bg2)) 100%);
          border-right: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
        }
        .sectionLabel {
          margin-bottom: 10px;
          color: color-mix(in oklab, var(--muted) 80%, #8b5e00);
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        h3 {
          margin: 0 0 18px;
          color: var(--text);
          font-size: 1.5rem;
          letter-spacing: -0.03em;
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
          grid-template-columns: 58px 1fr;
          gap: 16px;
          align-items: start;
          padding: 18px;
          border-radius: 22px;
          background:
            linear-gradient(180deg, color-mix(in oklab, var(--card-bg) 86%, #fffdf8) 0%, color-mix(in oklab, var(--bg2) 96%, #ffffff) 100%);
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
        }
        .stepIndex {
          display: inline-grid;
          place-items: center;
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background:
            linear-gradient(160deg, #ffd76a 0%, #f59e0b 100%);
          color: #4a2900;
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45);
        }
        .stepCard p {
          margin: 0;
          color: var(--text);
          line-height: 1.72;
          font-size: 0.98rem;
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
            min-height: 310px;
            padding: 18px 18px 22px;
            border-radius: 24px 24px 0 0;
          }
          .content {
            grid-template-columns: 1fr;
          }
          .ingredientsPanel {
            border-right: 0;
            border-bottom: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
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
            min-height: 280px;
            padding: 14px 14px 18px;
            border-radius: 28px 28px 0 0;
          }
          .heroTop {
            align-items: stretch;
            flex-direction: column;
          }
          .favoriteButton {
            width: fit-content;
          }
          .heroBody h2 {
            font-size: 2rem;
            line-height: 0.98;
          }
          .metrics {
            gap: 10px;
          }
          .metricCard {
            min-width: calc(50% - 5px);
            flex: 1 1 calc(50% - 5px);
          }
          .ingredientsPanel,
          .instructionsPanel {
            padding: 20px 16px 24px;
          }
          .stepCard {
            grid-template-columns: 46px 1fr;
            gap: 12px;
            padding: 14px;
            border-radius: 18px;
          }
          .stepIndex {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}
