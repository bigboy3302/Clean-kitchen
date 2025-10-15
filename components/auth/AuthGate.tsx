// components/auth/AuthGate.tsx
"use client";
import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { return onAuthStateChanged(auth, () => setReady(true)); }, []);
  return ready ? <>{children}</> : <>{fallback}</>;
}
