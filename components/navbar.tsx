"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Boxes, BookOpen, User, Dumbbell,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

type Item = { href: string; label: string; Icon: LucideIcon };

const items: Item[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", Icon: Boxes },
  { href: "/recipes", label: "Recipes", Icon: BookOpen },
  { href: "/fitness", label: "Fitness", Icon: Dumbbell },
  { href: "/profile", label: "Profile", Icon: User },
];

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx("nk-link", active && "nk-link--active")}
      aria-current={active ? "page" : undefined}
    >
      <span className="nk-iconWrap" aria-hidden>
        <Icon className="nk-icon" strokeWidth={1.8} />
      </span>
      <span className="nk-label">{label}</span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="nk-root" role="banner">
      <div className="nk-inner">
        <Link href="/dashboard" className="nk-brand">
          <span className="nk-brandMark" aria-hidden>
            ✦
          </span>
          <span className="nk-brandText">Clean&nbsp;Kitchen</span>
        </Link>

        <nav className="nk-nav" aria-label="Primary">
          {items.map(({ href, label, Icon }) => {
            const active =
              pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
            return (
              <NavLink key={href} href={href} label={label} Icon={Icon} active={!!active} />
            );
          })}
        </nav>
      </div>

      <style jsx>{`
        .nk-root {
          position: sticky;
          top: 0;
          z-index: 120;
          width: 100%;
          background: color-mix(in oklab, var(--bg) 88%, transparent);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
        }
        .nk-inner {
          margin: 0 auto;
          width: min(1120px, 100%);
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .nk-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: -0.01em;
          color: var(--text);
          text-decoration: none;
        }
        .nk-brandMark {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: color-mix(in oklab, var(--primary) 30%, var(--bg2));
          color: var(--primary-contrast);
          font-size: 16px;
        }
        .nk-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--bg2) 88%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
        }
        .nk-link {
          min-height: 44px;
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid transparent;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.01em;
          text-decoration: none;
          transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
            box-shadow 0.18s ease, transform 0.12s ease;
        }
        .nk-link:hover {
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 94%, var(--primary) 6%);
          border-color: color-mix(in oklab, var(--border) 70%, var(--primary) 20%);
        }
        .nk-link:active {
          transform: translateY(1px);
        }
        .nk-link:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px var(--ring);
        }
        .nk-link--active {
          color: var(--text);
          background: color-mix(in oklab, var(--primary) 18%, var(--bg));
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 14px 30px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        .nk-link--active .nk-iconWrap {
          color: var(--primary);
        }
        .nk-iconWrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          color: inherit;
          transition: color 0.18s ease;
        }
        .nk-icon {
          width: 20px;
          height: 20px;
        }
        .nk-label {
          white-space: nowrap;
        }

        @media (max-width: 940px) {
          .nk-inner {
            padding-inline: 16px;
            gap: 16px;
          }
          .nk-link {
            padding-inline: 12px;
          }
        }
        @media (max-width: 820px) {
          .nk-nav {
            gap: 6px;
          }
          .nk-label {
            display: none;
          }
          .nk-link {
            width: 44px;
            padding-inline: 0;
            justify-content: center;
          }
        }
      `}</style>
    </header>
  );
}
