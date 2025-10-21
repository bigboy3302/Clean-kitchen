"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Boxes, BookOpen, Dumbbell, User,
} from "lucide-react";
import clsx from "clsx";
import { useExpiringAlerts } from "@/hooks/useExpiringAlerts";

const tabs = [
  { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", Icon: Boxes },
  { href: "/recipes", label: "Recipes", Icon: BookOpen },
  { href: "/fitness", label: "Fitness", Icon: Dumbbell },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { alerts } = useExpiringAlerts();
  const expiringCount = alerts.length;

  return (
    <nav className="ck-bottomnav" role="navigation" aria-label="Primary">
      <div className="bn-shell">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
          const showAlert = href === "/pantry" && expiringCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={clsx("bn-item", active && "bn-item--active", showAlert && "bn-item--alert")}
              aria-current={active ? "page" : undefined}
              aria-label={
                showAlert
                  ? `${label}. ${expiringCount} item${expiringCount === 1 ? "" : "s"} need attention`
                  : label
              }
            >
              <span className="bn-iconWrap">
                <Icon className="bn-icon" strokeWidth={2} aria-hidden />
                {showAlert ? <span className="bn-badge" aria-hidden>{expiringCount}</span> : null}
              </span>
              <span className="bn-label">{label}</span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .bn-shell {
          width: min(520px, 100%);
          margin: 0 auto;
          background: color-mix(in oklab, var(--bg2) 90%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 26px;
          padding: 8px 10px;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          box-shadow: 0 20px 40px color-mix(in oklab, var(--primary) 8%, transparent);
          backdrop-filter: blur(16px);
        }
        .bn-item {
          position: relative;
          display: grid;
          grid-template-rows: auto auto;
          justify-items: center;
          align-content: center;
          gap: 4px;
          min-height: 44px;
          padding: 8px 6px;
          border-radius: 18px;
          border: 1px solid transparent;
          text-decoration: none;
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: color 0.18s ease, background 0.2s ease, border-color 0.2s ease,
            box-shadow 0.2s ease, transform 0.12s ease;
        }
        .bn-item:hover {
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 94%, var(--primary) 6%);
          border-color: color-mix(in oklab, var(--border) 70%, var(--primary) 22%);
        }
        .bn-item:active {
          transform: translateY(1px);
        }
        .bn-item:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px var(--ring);
        }
        .bn-item--active {
          color: var(--text);
          background: color-mix(in oklab, var(--primary) 16%, var(--bg));
          border-color: color-mix(in oklab, var(--primary) 42%, var(--border));
          box-shadow: 0 12px 28px color-mix(in oklab, var(--primary) 20%, transparent);
        }
        .bn-item--active .bn-iconWrap {
          color: var(--primary);
        }
        .bn-item--alert .bn-iconWrap::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 55%, var(--bg));
          opacity: 0.6;
        }
        .bn-iconWrap {
          position: relative;
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          color: inherit;
          transition: color 0.2s ease;
        }
        .bn-icon {
          width: 22px;
          height: 22px;
        }
        .bn-label {
          line-height: 1;
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
      `}</style>
    </nav>
  );
}
