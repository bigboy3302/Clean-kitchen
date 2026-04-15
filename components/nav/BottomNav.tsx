"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  BookOpen,
  Dumbbell,
  User,
  Bookmark,
  Menu,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useExpiringAlerts } from "@/hooks/useExpiringAlerts";

const tabs = [
  { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", Icon: Boxes },
  { href: "/recipes", label: "Recipes", Icon: BookOpen },
  { href: "/saved", label: "Saved Foods", Icon: Bookmark },
  { href: "/fitness", label: "Fitness", Icon: Dumbbell },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { alerts } = useExpiringAlerts();
  const [menuOpen, setMenuOpen] = useState(false);
  const expiringCount = alerts.length;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className={clsx("ck-bottomnav", menuOpen && "ck-bottomnav--open")} role="navigation" aria-label="Primary">
      <div className="bn-menu" aria-hidden={!menuOpen}>
        <div className="bn-menuHeader">
          <div>
            <span>Clean Kitchen</span>
            <strong>Menu</strong>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="bn-menuGrid">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
            const showAlert = href === "/pantry" && expiringCount > 0;

            return (
              <Link
                key={href}
                href={href}
                className={clsx("bn-menuItem", active && "bn-menuItem--active", showAlert && "bn-menuItem--alert")}
                aria-current={active ? "page" : undefined}
                aria-label={
                  showAlert
                    ? `${label}. ${expiringCount} item${expiringCount === 1 ? "" : "s"} need attention`
                    : label
                }
              >
                <span className="bn-menuIcon">
                  <Icon size={20} strokeWidth={2.2} aria-hidden />
                  {showAlert ? <span className="bn-badge" aria-hidden>{expiringCount}</span> : null}
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bn-shell">
        <button
          type="button"
          className={clsx("bn-menuButton", menuOpen && "bn-menuButton--open")}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {menuOpen ? <X size={25} strokeWidth={2.2} /> : <Menu size={25} strokeWidth={2.2} />}
          <span className="bn-srLabel">Menu</span>
        </button>
      </div>

      <style jsx>{`
        .bn-menu {
          position: relative;
          width: min(390px, calc(100vw - 28px));
          margin: 0 auto 8px;
          padding: 16px;
          border-radius: 26px;
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          background:
            linear-gradient(160deg, color-mix(in oklab, var(--bg2) 94%, transparent), color-mix(in oklab, var(--bg) 82%, var(--primary) 18%));
          box-shadow:
            0 28px 76px rgba(2, 6, 23, 0.32),
            0 0 0 1px color-mix(in oklab, var(--primary) 14%, transparent) inset;
          backdrop-filter: blur(20px) saturate(1.15);
          transform: translateY(12px) scale(0.98);
          transform-origin: bottom center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.2s ease;
          overflow: hidden;
        }
        .bn-menu::before {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          top: 0;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--primary), color-mix(in oklab, var(--ring) 82%, var(--primary)));
        }
        .ck-bottomnav--open .bn-menu {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .bn-menuHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 2px 2px 14px;
          color: var(--text);
        }
        .bn-menuHeader div {
          display: grid;
          gap: 2px;
        }
        .bn-menuHeader span {
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: 0.68rem;
          color: var(--primary);
        }
        .bn-menuHeader strong {
          font-size: 1.08rem;
          line-height: 1;
          letter-spacing: 0;
        }
        .bn-menuHeader button {
          width: 34px;
          height: 34px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: color-mix(in oklab, var(--bg2) 82%, transparent);
          color: var(--text);
          cursor: pointer;
          backdrop-filter: blur(10px);
        }
        .bn-menuGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }
        .bn-menuItem {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 58px;
          padding: 11px 12px;
          border-radius: 20px;
          border: 1px solid color-mix(in oklab, var(--border) 74%, transparent);
          background:
            linear-gradient(145deg, color-mix(in oklab, var(--bg2) 90%, transparent), color-mix(in oklab, var(--bg) 82%, var(--primary) 8%));
          color: var(--text);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 750;
          box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 7%, transparent);
          transition: transform 0.14s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }
        .bn-menuItem:hover {
          transform: translateY(-1px);
          border-color: color-mix(in oklab, var(--primary) 42%, var(--border));
          box-shadow: 0 14px 30px color-mix(in oklab, var(--primary) 13%, transparent);
        }
        .bn-menuItem--active {
          background:
            linear-gradient(145deg, color-mix(in oklab, var(--primary) 21%, var(--bg2)), color-mix(in oklab, var(--bg2) 86%, var(--primary) 14%));
          border-color: color-mix(in oklab, var(--primary) 46%, var(--border));
          box-shadow: 0 14px 32px color-mix(in oklab, var(--primary) 16%, transparent);
        }
        .bn-menuIcon {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          color: var(--primary);
          background:
            radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 52%),
            color-mix(in oklab, var(--primary) 11%, var(--bg));
        }
        .bn-shell {
          width: fit-content;
          margin: 0 auto;
          background: transparent;
          border: 0;
          border-radius: 999px;
          padding: 0;
          display: grid;
          place-items: center;
        }
        .bn-menuButton {
          display: grid;
          place-items: center;
          align-content: center;
          width: 62px;
          height: 62px;
          margin: -12px auto 0;
          border: 1px solid color-mix(in oklab, var(--primary) 48%, var(--border));
          border-radius: 999px;
          background:
            radial-gradient(circle at 30% 15%, color-mix(in oklab, var(--primary-contrast) 36%, transparent), transparent 42%),
            linear-gradient(145deg, var(--primary), color-mix(in oklab, var(--primary) 68%, var(--text) 32%));
          color: var(--primary-contrast);
          box-shadow:
            0 18px 38px color-mix(in oklab, var(--primary) 32%, transparent),
            0 0 0 7px color-mix(in oklab, var(--primary) 10%, transparent),
            inset 0 1px 0 color-mix(in oklab, var(--primary-contrast) 28%, transparent);
          cursor: pointer;
          font: inherit;
          transition: transform 0.14s ease, filter 0.18s ease, box-shadow 0.18s ease;
        }
        .bn-menuButton:hover {
          transform: translateY(-1px);
        }
        .bn-menuButton--open {
          filter: saturate(1.05) brightness(1.03);
        }
        .bn-menuButton:focus-visible,
        .bn-menuHeader button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px var(--ring);
        }
        .bn-badge {
          position: absolute;
          top: -6px;
          right: -10px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: color-mix(in oklab, var(--primary) 80%, var(--bg) 20%);
          color: var(--primary-contrast);
          box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 35%, transparent);
        }
        .bn-srLabel {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 380px) {
          .bn-menuButton {
            width: 58px;
            height: 58px;
          }
          .bn-menuGrid {
            gap: 8px;
          }
          .bn-menuItem {
            padding: 10px;
          }
        }
      `}</style>
    </nav>
  );
}
