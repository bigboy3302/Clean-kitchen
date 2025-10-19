"use client";

import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setChecking(false);
        router.replace("/auth/login");
        return;
      }

      const isPasswordProvider = u.providerData.some(p => p.providerId === "password");
      if (isPasswordProvider && !u.emailVerified) {
        setChecking(false);
        router.replace("/auth/verify");
        return;
      }

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const hasProfile = snap.exists() && !!snap.data()?.username;

      if (!hasProfile) {
        setChecking(false);
        router.replace("/onboarding");
        return;
      }

      setChecking(false);
    });
    return () => unsub();
  }, [router]);

  if (checking) return <div className="p-6 text-gray-600">Loading…</div>;
  return <>{children}</>;
}
