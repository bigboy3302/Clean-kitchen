"use client";

import Link from "next/link";
import React, { useMemo, useRef, useState, useEffect } from "react";
import useNavPrefs, { defaultNavPrefs } from "./useNavPrefs";

type ItemKey = "dashboard" | "pantry" | "recipes" | "fitness" | "profile";

const ALL_ITEMS: Record<ItemKey, { href: string; label: string; icon: JSX.Element }> = {
  dashboard: {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6a3 3 0 0 0-6 0v6H4a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    ),
  },
  pantry: {
    href: "/pantry",
    label: "Pantry",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M6 8V6a3 3 0 1 1 6 0v2" />
        <path d="M4 8h16l-1.2 12.4A2 2 0 0 1 16.81 22H7.19a2 2 0 0 1-1.99-1.6L4 8z" />
        <path d="M9 8v2a3 3 0 1 0 6 0V8" />
      </svg>
    ),
  },
  recipes: {
    href: "/recipes",
    label: "Recipes",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
        <path d="M7 4v13a3 3 0 0 0 3 3" />
        <path d="M8 9h7M8 12h5" />
      </svg>
    ),
  },
  fitness: {
    href: "/fitness",
    label: "Fitness",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M6 8v8M10 6v12M14 6v12M18 8v8" />
        <path d="M8 12h8" />
      </svg>
    ),
  },
  profile: {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
};

export default function FabNav() {
  const { nav } = useNavPrefs();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const order = useMemo<ItemKey[]>(
    () => (nav?.order && nav.order.length ? (nav.order as ItemKey[]) : defaultNavPrefs.order),
    [nav?.order]
  );
  const split = Math.floor(order.length / 2);
  const leftItems = order.slice(0, split);
  const rightItems = order.slice(split);

  const placement = nav?.placement ?? defaultNavPrefs.placement;
  const posClass =
    placement === "header" ? "pos-header" : placement === "top" ? "pos-top" : "pos-bottom";

  const styleVars: React.CSSProperties = {
    ["--pill" as any]: nav?.accent ?? "var(--navbar-bg)",
    ["--icon" as any]: nav?.icon ?? "var(--navbar-fg)",
    ["--h" as any]: (nav?.compact ?? defaultNavPrefs.compact) ? "48px" : "56px",
    ["--w-open" as any]: (nav?.compact ?? defaultNavPrefs.compact) ? "460px" : "560px",
    ["--glow" as any]: (nav?.glow ?? defaultNavPrefs.glow)
      ? "0 16px 40px rgba(0,0,0,.22)"
      : "0 8px 20px rgba(0,0,0,.10)",
    ["--bdr" as any]: "color-mix(in oklab, #000 12%, var(--pill))",
  };

  return (
    <nav aria-label="Main" className={`fabnav ${posClass}`} style={styleVars} ref={wrapRef}>
      <div className={`shelf ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="cols">
          <div className="side left">
            {leftItems.map((k) => {
              const it = ALL_ITEMS[k];
              return (
                <Link key={k} href={it.href} className="btn" aria-label={it.label} onClick={() => setOpen(false)}>
                  {it.icon}
                  <span className="visually-hidden">{it.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="spacer" aria-hidden="true" />
          <div className="side right">
            {rightItems.map((k) => {
              const it = ALL_ITEMS[k];
              return (
                <Link key={k} href={it.href} className="btn" aria-label={it.label} onClick={() => setOpen(false)}>
                  {it.icon}
                  <span className="visually-hidden">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`toggle ${open ? "open" : ""}`}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dots">
          <i /><i /><i />
        </span>
      </button>

      <style jsx>{`
        .fabnav {
          --pill: var(--navbar-bg);
          --icon: var(--navbar-fg);
          --h: 56px;
          --w-open: 560px;
          --glow: 0 16px 40px rgba(0,0,0,.18);
          --bdr: color-mix(in oklab, #000 12%, var(--pill));
          position: relative;
          z-index: 50;
        }
        .pos-header { height: var(--h); display: grid; place-items: center; }
        .pos-top, .pos-bottom {
          position: fixed; left: 50%; transform: translateX(-50%);
          width: var(--w-open); pointer-events: none;
        }
        .pos-top { top: 14px; }
        .pos-bottom { bottom: 14px; }

        .shelf {
          position: absolute; left: 50%; top: 50%;
          height: var(--h); width: var(--w-open);
          transform: translate(-50%, -50%) scaleX(0);
          transform-origin: 50% 50%;
          border-radius: 999px;
          background: var(--pill);
          border: 1px solid var(--bdr);
          box-shadow: var(--glow);
          transition: transform 0.28s ease;
          pointer-events: none;
          color: var(--icon);
        }
        .shelf.open { transform: translate(-50%, -50%) scaleX(1); pointer-events: auto; }

        .cols { height: 100%; display: grid; grid-template-columns: 1fr var(--h) 1fr; align-items: center; }
        .spacer { width: var(--h); height: 100%; }
        .side { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 0 12px; }

        .btn {
          display: grid; place-items: center;
          min-width: 54px; height: calc(var(--h) - 16px);
          padding: 8px 10px; border-radius: 12px; text-decoration: none;
          color: var(--icon);
          border: 1px solid color-mix(in oklab, var(--icon) 20%, transparent);
          background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0));
          transition: transform .12s ease, background .2s ease, border-color .2s ease;
        }
        .btn:hover { transform: translateY(-2px); }
        .btn:active { transform: translateY(-1px) scale(0.99); }
        .btn svg { width: 22px; height: 22px; stroke: currentColor; }

        .visually-hidden {
          position: absolute !important; height: 1px; width: 1px; overflow: hidden;
          clip: rect(1px, 1px, 1px, 1px); white-space: nowrap; border: 0; padding: 0; margin: -1px;
        }

        .toggle {
          position: absolute; left: 50%; top: 50%;
          width: var(--h); height: var(--h);
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 1px solid var(--bdr);
          background: var(--pill);
          color: var(--icon);
          box-shadow: var(--glow);
          cursor: pointer; display: grid; place-items: center; pointer-events: auto;
        }
        .dots { position: relative; width: 22px; height: 22px; }
        .dots i {
          position: absolute; left: 50%; top: 50%;
          width: 6px; height: 6px; margin: -3px 0 0 -3px;
          background: currentColor;
          border-radius: 999px;
          transition: transform 0.28s ease, height 0.28s ease, width 0.28s ease, border-radius 0.28s ease, opacity 0.2s ease;
        }
        .dots i:nth-child(1) { transform: translate(-8px, 0); }
        .dots i:nth-child(2) { transform: translate(0, 0); }
        .dots i:nth-child(3) { transform: translate(8px, 0); }
        .toggle.open .dots i { width: 4px; height: 24px; border-radius: 2px; }
        .toggle.open .dots i:nth-child(1) { transform: translate(0, 0) rotate(45deg); }
        .toggle.open .dots i:nth-child(2) { opacity: 0; }
        .toggle.open .dots i:nth-child(3) { transform: translate(0, 0) rotate(-45deg); }

        .pos-top .shelf, .pos-bottom .shelf, .pos-top .toggle, .pos-bottom .toggle { pointer-events: auto; }
      `}</style>
    </nav>
  );
}
