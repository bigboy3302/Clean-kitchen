"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Boxes, BookOpen, User, Dumbbell,
  type LucideIcon
} from "lucide-react";
import clsx from "clsx";

type Item = { href: string; label: string; Icon: LucideIcon };

const items: Item[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/pantry",    label: "Pantry",    Icon: Boxes },
  { href: "/recipes",   label: "Recipes",   Icon: BookOpen },
  { href: "/fitness",   label: "Fitness",   Icon: Dumbbell },
  { href: "/profile",   label: "Profile",   Icon: User },
];

function NavLink({
  href, label, Icon, active,
}: {
  href: string; label: string; Icon: LucideIcon; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-700 hover:bg-gray-900/5 hover:text-gray-900"
      )}
    >
      {/* lucide uses currentColor; class controls color; strokeWidth improves visibility */}
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Clean-Kitchen
        </Link>
        <nav className="flex items-center gap-1">
          {items.map(({ href, label, Icon }) => {
            const active =
              pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
            return (
              <NavLink key={href} href={href} label={label} Icon={Icon} active={!!active} />
            );
          })}
        </nav>
      </div>
    </header>
  );
}
