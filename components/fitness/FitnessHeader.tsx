"use client";

import { useEffect, useRef } from "react";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch?: () => void;
};

export default function FitnessHeader({ search, onSearchChange, onClearSearch }: Props) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchRef.current) searchRef.current.value = search;
  }, [search]);

  return (
    <header className="fitnessHeader" role="banner">
      <div className="heading">
        <div>
          <p className="eyebrow">Daily planning</p>
          <h1>Fitness studio</h1>
          <p className="sub">Track macros, explore workouts, and build a routine that sticks.</p>
        </div>
        <label className="search" aria-label="Search workouts">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.28a6 6 0 1 0-.71.71l.28.28v.79l4.25 4.25a1 1 0 0 0 1.41-1.41L15.5 14zM10 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search movement (e.g., push-up)"
            defaultValue={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search workouts"
          />
          {search ? (
            <button
              type="button"
              className="clear"
              aria-label="Clear search"
              onClick={() => {
                onClearSearch?.();
                requestAnimationFrame(() => searchRef.current?.focus());
              }}
            >
              ✕
            </button>
          ) : null}
        </label>
      </div>

      <style jsx>{`
        .fitnessHeader {
          /* Non-sticky: header scrolls with the page */
          position: static;
          z-index: 60;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 16px 18px;
          border-radius: 24px;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          box-shadow: 0 24px 60px color-mix(in oklab, var(--bg) 60%, rgba(15, 23, 42, 0.22));
          backdrop-filter: blur(16px);
        }
        .heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        h1 {
          margin: 4px 0 6px;
          font-size: clamp(1.85rem, 3vw + 1rem, 2.6rem);
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .sub {
          margin: 0;
          color: var(--muted);
          font-size: 0.95rem;
          max-width: 480px;
        }
        .search {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: var(--bg);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding: 10px 14px;
          border-radius: 999px;
          min-width: min(320px, 100%);
          box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--bg2) 80%, transparent);
        }
        .search svg {
          width: 20px;
          height: 20px;
          stroke: currentColor;
          fill: none;
        }
        .search input {
          border: 0;
          background: transparent;
          font: inherit;
          color: var(--text);
          width: 100%;
        }
        .search input:focus {
          outline: none;
        }
        .clear {
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        @media (max-width: 720px) {
          .fitnessHeader {
            padding: 14px 16px;
            border-radius: 20px;
          }
          .heading {
            align-items: flex-start;
          }
          .search {
            width: 100%;
          }
          .actions {
            width: 100%;
          }
        }
      `}</style>
    </header>
  );
}
