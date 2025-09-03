"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { initAuthListener, useAuthStore } from "@/lib/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => { initAuthListener(); }, []);
  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  if (user === undefined) return <div className="p-6">Loading...</div>;
  if (user === null) return null;
  return <>{children}</>;
}
