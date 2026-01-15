"use client";

import React, { useMemo } from "react";

type Props = {
  value: string;
  ingredients: string[];
  onValueChange: (value: string) => void;
  onIngredientsChange: (ingredients: string[]) => void;
  onSearch: (ingredients: string[]) => void | Promise<void>;
  isLoading?: boolean;
  maxIngredients?: number;
};

const COMMON = ["chicken", "rice", "tomato", "onion", "garlic", "eggs", "milk", "pasta", "potato"];
const DEFAULT_MAX = 10;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function IngredientSearch({
  value,
  ingredients,
  onValueChange,
  onIngredientsChange,
  onSearch,
  isLoading,
  maxIngredients = DEFAULT_MAX,
}: Props) {
  const canSearch = ingredients.length > 0 && !isLoading;
  const atLimit = ingredients.length >= maxIngredients;
  const normalizedValue = normalize(value);

  const suggestions = useMemo(() => {
    if (!normalizedValue || atLimit) return [];
    return COMMON.filter(
      (item) => item.startsWith(normalizedValue) && !ingredients.includes(item)
    ).slice(0, 5);
  }, [normalizedValue, ingredients, atLimit]);

  const addIngredient = () => {
    if (atLimit) return;
    const next = normalizedValue;
    if (!next) return;
    if (ingredients.includes(next)) {
      onValueChange("");
      return;
    }
    onIngredientsChange([...ingredients, next]);
    onValueChange("");
  };

  const removeIngredient = (ing: string) => {
    onIngredientsChange(ingredients.filter((item) => item !== ing));
  };

  const clearAll = () => {
    onIngredientsChange([]);
    onValueChange("");
  };

  const label = useMemo(() => {
    if (ingredients.length === 0) return "Search";
    return `Search with ${ingredients.length} ingredient${ingredients.length > 1 ? "s" : ""}`;
  }, [ingredients.length]);

  return (
    <>
      <div className="recipeSearchRow">
        <div className="ingredientField">
          <input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="Add ingredient (e.g., chicken, rice, tomato)"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addIngredient();
              }
            }}
          />
          {suggestions.length > 0 ? (
            <div className="suggestions" role="listbox">
              {suggestions.map((item) => (
                <button
                  className="suggestionItem"
                  type="button"
                  key={item}
                onClick={() => {
                  if (atLimit) return;
                  onIngredientsChange([...ingredients, item]);
                  onValueChange("");
                }}
              >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          className="btn-base btn--secondary btn--md"
          type="button"
          onClick={addIngredient}
          disabled={!value.trim() || atLimit}
        >
          Add
        </button>

        <button
          className="btn-base btn--primary btn--md"
          type="button"
          onClick={() => onSearch(ingredients)}
          disabled={!canSearch}
        >
          {label}
        </button>
      </div>

      {ingredients.length > 0 ? (
        <div className="chipRow">
          {ingredients.map((ing) => (
            <span key={ing} className="chip">
              {ing}
              <button
                className="chipX"
                type="button"
                onClick={() => removeIngredient(ing)}
                aria-label={`Remove ${ing}`}
              >
                ×
              </button>
            </span>
          ))}
          <button className="btn-base btn--ghost btn--sm" type="button" onClick={clearAll}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="searchHint">
        {atLimit ? `Max ${maxIngredients} ingredients.` : "Tip: add multiple ingredients to match recipes that include all of them (AND)."}
      </div>
    </>
  );
}
