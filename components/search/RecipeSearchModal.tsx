"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, Loader2, Search, Sparkles, X } from "lucide-react";

type RecipeResult = {
  id?: string | number | null;
  title?: string | null;
  imageURL?: string | null;
  image?: string | null;
  source?: string | null;
  category?: string | null;
  area?: string | null;
  timeMinutes?: number | null;
};

type SearchResponse = {
  results?: RecipeResult[];
  totalResults?: number;
  error?: string;
  note?: string;
};

const QUICK_SEARCHES = ["chicken", "pasta", "salad", "rice", "breakfast", "soup"];

export default function RecipeSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmedQuery = query.trim();
  const title = trimmedQuery ? `Results for “${trimmedQuery}”` : "Find a recipe";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const searchTerm = trimmedQuery;
    if (searchTerm.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/recipes/search?q=${encodeURIComponent(searchTerm)}&number=8`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(payload?.error || "Recipe search failed.");
        }

        setResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message || "Something went wrong while searching.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmedQuery]);

  const hasQuery = trimmedQuery.length >= 2;

  const helperCopy = useMemo(() => {
    if (!trimmedQuery) return "Start typing and recipes will appear here in real time.";
    if (trimmedQuery.length < 2) return "Type at least 2 letters to search.";
    if (loading) return "Searching recipe ideas…";
    if (error) return error;
    if (!results.length) return "No recipes found. Try chicken, pasta, rice, soup, or breakfast.";
    return "Pick a recipe to open the full details page.";
  }, [trimmedQuery, loading, error, results.length]);

  if (!open) return null;

  return (
    <div className="ck-recipe-search-overlay" role="dialog" aria-modal="true" aria-labelledby="recipe-search-title" onMouseDown={onClose}>
      <section className="ck-recipe-search-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="ck-search-decor ck-search-decor-one" aria-hidden />
        <div className="ck-search-decor ck-search-decor-two" aria-hidden />

        <header className="ck-search-head">
          <div>
            <p className="ck-search-eyebrow">
              <Sparkles size={14} aria-hidden /> Live recipe search
            </p>
            <h2 id="recipe-search-title">{title}</h2>
            <p>{helperCopy}</p>
          </div>
          <button type="button" className="ck-search-close" onClick={onClose} aria-label="Close recipe search">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="ck-search-input-wrap">
          <Search size={20} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chicken pasta, curry, soup..."
            aria-label="Search recipes"
          />
          {loading ? <Loader2 className="ck-search-spinner" size={20} aria-hidden /> : null}
        </div>

        {!hasQuery ? (
          <div className="ck-quick-searches" aria-label="Quick recipe searches">
            {QUICK_SEARCHES.map((item) => (
              <button key={item} type="button" onClick={() => setQuery(item)}>
                {item}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="ck-search-error">{error}</p> : null}

        <div className="ck-search-results" aria-live="polite">
          {results.map((recipe) => {
            const id = String(recipe.id ?? "");
            const href = recipe.source === "themealdb" ? `/recipes/ext/${id}` : `/recipes/${id}`;
            const image = recipe.imageURL || recipe.image || "/placeholder.png";
            return (
              <Link key={`${recipe.source || "recipe"}-${id}`} href={href} className="ck-search-result" onClick={onClose}>
                <span className="ck-result-image">
                  <Image src={image} alt="" fill sizes="76px" />
                </span>
                <span className="ck-result-copy">
                  <strong>{recipe.title || "Untitled recipe"}</strong>
                  <small>
                    <Clock size={13} aria-hidden />
                    {recipe.category || recipe.area || recipe.source || "Recipe"}
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden />
              </Link>
            );
          })}

          {hasQuery && !loading && !error && results.length === 0 ? (
            <div className="ck-search-empty">
              <strong>No recipe matches yet</strong>
              <span>Try a simpler search like “pasta”, “chicken”, or “soup”.</span>
            </div>
          ) : null}
        </div>
      </section>

      <style jsx global>{`
        .ck-recipe-search-overlay {
          position: fixed;
          inset: 0;
          z-index: 1400;
          display: grid;
          place-items: center;
          padding: 24px;
          background: color-mix(in oklab, var(--bg) 34%, rgba(0, 0, 0, 0.68));
          backdrop-filter: blur(18px) saturate(1.1);
          -webkit-backdrop-filter: blur(18px) saturate(1.1);
        }

        .ck-recipe-search-modal {
          position: relative;
          width: min(760px, 100%);
          max-height: min(760px, 88vh);
          overflow: hidden;
          display: grid;
          grid-template-rows: auto auto auto 1fr;
          border-radius: 34px;
          padding: 28px;
          color: var(--text);
          background:
            radial-gradient(circle at 88% 0%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 30%),
            linear-gradient(145deg, color-mix(in oklab, var(--bg2) 94%, white 6%), color-mix(in oklab, var(--bg) 86%, var(--bg2) 14%));
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          box-shadow: 0 42px 140px rgba(0, 0, 0, 0.38);
        }

        .ck-search-decor {
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
          filter: blur(24px);
          opacity: 0.55;
        }

        .ck-search-decor-one {
          width: 180px;
          height: 180px;
          right: -70px;
          top: -70px;
          background: color-mix(in oklab, var(--primary) 38%, transparent);
        }

        .ck-search-decor-two {
          width: 220px;
          height: 220px;
          left: -100px;
          bottom: -110px;
          background: color-mix(in oklab, var(--ring) 42%, transparent);
        }

        .ck-search-head {
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .ck-search-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 10px;
          color: var(--primary);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .ck-search-head h2 {
          margin: 0;
          max-width: 12ch;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(34px, 6vw, 58px);
          line-height: 0.94;
          letter-spacing: -0.07em;
          color: var(--text);
        }

        .ck-search-head p:not(.ck-search-eyebrow) {
          max-width: 48ch;
          margin: 12px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .ck-search-close {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 16px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 78%, transparent);
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .ck-search-input-wrap {
          position: relative;
          z-index: 1;
          min-height: 62px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 18px;
          border-radius: 22px;
          background: color-mix(in oklab, var(--bg2) 88%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.08);
          color: var(--muted);
        }

        .ck-search-input-wrap input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-size: 16px;
          font-weight: 750;
        }

        .ck-search-input-wrap input::placeholder {
          color: color-mix(in oklab, var(--muted) 70%, transparent);
        }

        .ck-search-spinner {
          animation: ckSpin 0.8s linear infinite;
          color: var(--primary);
        }

        @keyframes ckSpin {
          to { transform: rotate(360deg); }
        }

        .ck-quick-searches {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 16px 0 2px;
        }

        .ck-quick-searches button {
          border: 0;
          border-radius: 999px;
          padding: 9px 13px;
          cursor: pointer;
          color: var(--text);
          background: color-mix(in oklab, var(--primary) 11%, var(--bg2));
          font-size: 13px;
          font-weight: 850;
        }

        .ck-search-error {
          margin: 14px 0 0;
          border-radius: 16px;
          padding: 12px 14px;
          color: #b91c1c;
          background: rgba(239, 68, 68, 0.1);
          font-weight: 800;
        }

        .ck-search-results {
          position: relative;
          z-index: 1;
          min-height: 140px;
          overflow-y: auto;
          display: grid;
          gap: 10px;
          margin-top: 18px;
          padding-right: 4px;
        }

        .ck-search-result {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          min-height: 92px;
          padding: 10px 12px 10px 10px;
          border-radius: 24px;
          color: var(--text);
          text-decoration: none;
          background: color-mix(in oklab, var(--bg2) 82%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 62%, transparent);
          transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .ck-search-result:hover {
          transform: translateY(-2px);
          text-decoration: none;
          background: color-mix(in oklab, var(--primary) 8%, var(--bg2));
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.12);
        }

        .ck-result-image {
          position: relative;
          width: 76px;
          height: 76px;
          overflow: hidden;
          border-radius: 20px;
          background: color-mix(in oklab, var(--primary) 12%, var(--bg));
        }

        .ck-result-image img {
          object-fit: cover;
        }

        .ck-result-copy {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .ck-result-copy strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.035em;
        }

        .ck-result-copy small {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 750;
        }

        .ck-search-empty {
          min-height: 150px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 8px;
          border-radius: 24px;
          border: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
          color: var(--muted);
          text-align: center;
          background: color-mix(in oklab, var(--bg2) 64%, transparent);
        }

        .ck-search-empty strong {
          color: var(--text);
          font-weight: 950;
        }

        @media (max-width: 620px) {
          .ck-recipe-search-overlay { padding: 12px; align-items: end; }
          .ck-recipe-search-modal {
            max-height: 92vh;
            border-radius: 28px;
            padding: 20px;
          }
          .ck-search-head h2 { max-width: 9ch; }
          .ck-search-result { grid-template-columns: 62px minmax(0, 1fr) auto; }
          .ck-result-image { width: 62px; height: 62px; border-radius: 18px; }
        }
      `}</style>
    </div>
  );
}
