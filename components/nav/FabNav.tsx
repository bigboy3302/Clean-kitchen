// components/nav/FabNav.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

type Item = {
  href: string;
  label: string;
  hue: number; // just for a subtle individual tint
  icon: JSX.Element;
};

// simple inline SVGs so we don't pull icon fonts
const Icon = {
  Home: (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5l9-7 9 7M5.25 9.75V20a.75.75 0 00.75.75h3.75a.75.75 0 00.75-.75v-4.5a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75V20a.75.75 0 00.75.75H18a.75.75 0 00.75-.75V9.75" />
    </svg>
  ),
  Fridge: (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.6">
      <rect x="6" y="3" width="12" height="18" rx="2.2" />
      <path d="M6 11.5h12" />
      <circle cx="9.75" cy="8.25" r="0.9" fill="currentColor" />
      <circle cx="9.75" cy="14.75" r="0.9" fill="currentColor" />
    </svg>
  ),
  Book: (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25A2.25 2.25 0 016 3h11.25A2.25 2.25 0 0119.5 5.25v12A2.25 2.25 0 0117.25 19.5H6A2.25 2.25 0 013.75 17.25V5.25z" />
      <path d="M8.25 6.75h7.5M8.25 9.75h7.5M8.25 12.75h4.5" />
    </svg>
  ),
  Dumbbell: (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8">
      <rect x="2.75" y="8.25" width="3" height="7.5" rx="0.8" />
      <rect x="18.25" y="8.25" width="3" height="7.5" rx="0.8" />
      <rect x="7.25" y="10.25" width="9.5" height="3.5" rx="0.9" />
    </svg>
  ),
  User: (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a8.25 8.25 0 0115 0" />
    </svg>
  ),
  Dots: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="17.5" cy="12" r="1.6" />
    </svg>
  ),
  X: (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
};

export default function FabNav() {
  const [open, setOpen] = useState(false);

  const items: Item[] = [
    { href: "/dashboard", label: "Dashboard", hue: 12, icon: Icon.Home },
    { href: "/pantry", label: "Pantry", hue: 210, icon: Icon.Fridge },
    { href: "/recipes", label: "Recipes", hue: 295, icon: Icon.Book },
    { href: "/fitness", label: "Fitness", hue: 265, icon: Icon.Dumbbell },
    { href: "/profile", label: "Profile", hue: 240, icon: Icon.User },
  ];

  return (
    <div className={`fabDock ${open ? "open" : ""}`}>
      {/* pill rail */}
      <div className="rail" aria-hidden={!open}>
        <ul className="railList">
          {items.map((it) => (
            <li key={it.href} style={{ ["--h" as any]: it.hue }}>
              <Link href={it.href} className="railBtn" onClick={() => setOpen(false)} aria-label={it.label}>
                <span className="ico">{it.icon}</span>
                <span className="txt">{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* central toggle */}
      <button
        className="toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dot">{open ? Icon.X : Icon.Dots}</span>
      </button>

      <style jsx>{`
        .fabDock {
          justify-self: center;
          position: relative;
          height: 72px;
          display: grid;
          place-items: center;
        }

        /* glassy pill behind icons */
        .rail {
          position: absolute;
          inset: 0;
          width: 560px;
          max-width: min(92vw, 560px);
          height: 56px;
          background: color-mix(in oklab, var(--bg2) 70%, transparent);
          border: 1px solid var(--border);
          border-radius: 999px;
          box-shadow: 0 10px 30px color-mix(in oklab, #000 14%, transparent);
          padding: 6px 60px; /* space for center button */
          transform: scaleX(0);
          transform-origin: center;
          opacity: 0;
          transition: transform .28s ease, opacity .25s ease;
          backdrop-filter: blur(8px);
          pointer-events: none;
        }
        .fabDock.open .rail { transform: scaleX(1); opacity: 1; pointer-events: auto; }

        .railList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-auto-flow: column;
          gap: 10px;
          align-items: center;
          justify-content: center;
        }
        .railList li {
          --accent: hsl(var(--h, 220) 85% 60%);
          --accent-ghost: color-mix(in oklab, var(--accent) 18%, transparent);
        }
        .railBtn {
          display: grid;
          grid-template-columns: 28px auto;
          gap: 8px;
          align-items: center;
          padding: 8px 12px;
          text-decoration: none;
          color: var(--text);
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          transition: transform .12s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
          box-shadow: 0 2px 0 0 #fff inset, 0 2px 0 0 color-mix(in oklab, #000 20%, transparent);
        }
        .railBtn:hover {
          transform: translateY(-2px);
          background: var(--accent-ghost);
          border-color: color-mix(in oklab, var(--accent) 40%, var(--border));
          box-shadow: 0 8px 22px color-mix(in oklab, var(--accent) 22%, transparent);
        }

        .ico {
          width: 28px; height: 28px; display: grid; place-items: center;
          color: var(--text);
        }
        .ico :global(svg) { width: 22px; height: 22px; }

        .txt { font-weight: 600; font-size: 14px; color: var(--text); }

        /* center toggle button */
        .toggle {
          position: relative;
          z-index: 2;
          width: 64px;
          height: 64px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 40%, var(--border));
          background: var(--primary);
          color: var(--primary-contrast);
          display: grid; place-items: center;
          box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 30%, transparent);
          cursor: pointer;
          transition: transform .08s ease, filter .18s ease;
        }
        .toggle:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .toggle:active { transform: translateY(0); }

        .dot :global(svg){ width: 26px; height: 26px; }

        /* collapse to compact on small screens */
        @media (max-width: 640px) {
          .rail { padding: 6px 58px; }
          .txt { display: none; }
          .railBtn { grid-template-columns: 28px; padding: 10px; }
        }
      `}</style>
    </div>
  );
}
