// components/auth/AuthGate.tsx
"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebas1e";

export default function AuthGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => { return onAuthStateChanged(auth, () => setReady(true)); }, []);
  const isPublic =
    pathname.startsWith("/recipes/ext") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");
  if (isPublic) return <>{children}</>;
  return ready ? <>{children}</> : <>{fallback}</>;
}
