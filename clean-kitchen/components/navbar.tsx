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

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-700 hover:bg-gray-100"
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold">
          Clean-Kitchen
        </Link>

        <nav className="flex items-center gap-1">
          {items.map(({ href, label, Icon }) => {
            const active =
              pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
            return (
              <NavLink
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={!!active}
              />
            );
          })}
        </nav>
      </div>
    </header>
  );
}
