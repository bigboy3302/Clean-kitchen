"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Boxes, BookOpen, User } from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/pantry",    label: "Pantry",    Icon: Boxes },
  { href: "/recipes",   label: "Recipes",   Icon: BookOpen },
  { href: "/profile",   label: "Profile",   Icon: User },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          <span className="rounded-lg bg-brand-100 px-2 py-1 text-brand-700">Clean</span>-Kitchen
        </Link>

        <nav className="flex items-center gap-1">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
