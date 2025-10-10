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
  { href: "/pantry",    label: "Pantry", Icon: Boxes },
  { href: "/recipes",   label: "Recipes", Icon: BookOpen },
  { href: "/fitness",   label: "Fitness", Icon: Dumbbell },
  { href: "/profile",   label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { alerts } = useExpiringAlerts();
  const expiringCount = alerts.length;

  return (
    <nav className="ck-bottomnav" role="navigation" aria-label="Primary">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "ck-tab",
              active && "ck-tab--active",
              href === "/pantry" && expiringCount > 0 && "ck-tab--alert"
            )}
            aria-current={active ? "page" : undefined}
            aria-label={
              href === "/pantry" && expiringCount > 0
                ? `${label}. ${expiringCount} item${expiringCount === 1 ? "" : "s"} need attention`
                : label
            }
          >
            <Icon className="ck-tab-ico" strokeWidth={2} aria-hidden />
            {href === "/pantry" && expiringCount > 0 ? (
              <span className="ck-badge" aria-hidden>{expiringCount}</span>
            ) : null}
            <span className="ck-tab-label">{label}</span>
          </Link>
        );
      })}

      <style jsx>{`
        .ck-tab {
          position: relative;
        }
        .ck-badge {
          position: absolute;
          top: 6px;
          right: 22px;
          min-width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: grid;
          place-items: center;
          padding: 0 4px;
          box-shadow: 0 8px 18px rgba(239, 68, 68, 0.35);
        }
        .ck-tab.ck-tab--alert .ck-tab-ico {
          color: #ef4444;
        }
      `}</style>
    </nav>
  );
}
