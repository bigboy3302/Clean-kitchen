"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Boxes, BookOpen, Dumbbell, User,
} from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/pantry",    label: "Pantry", Icon: Boxes },
  { href: "/recipes",   label: "Recipes", Icon: BookOpen },
  { href: "/fitness",   label: "Fitness", Icon: Dumbbell },
  { href: "/profile",   label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="ck-bottomnav" role="navigation" aria-label="Primary">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={clsx("ck-tab", active && "ck-tab--active")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="ck-tab-ico" strokeWidth={2} aria-hidden />
            <span className="ck-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
