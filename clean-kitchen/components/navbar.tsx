"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pantry", label: "Pantry" },
  { href: "/recipes", label: "Recipes" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <div className="w-full border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-3">
        <Link href="/dashboard" className="font-bold">Clean-Kitchen</Link>
        <nav className="flex gap-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? "font-semibold" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Button onClick={() => signOut(auth)}>Logout</Button>
      </div>
    </div>
  );
}
