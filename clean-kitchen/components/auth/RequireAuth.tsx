"use client";

import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function RequireAuth({
  children,
  redirectTo = "/auth/login",
  requireProfile = true,
}: {
  children: ReactNode;
  redirectTo?: string;
  requireProfile?: boolean;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        router.replace(redirectTo);
        return;
      }
      if (requireProfile) {
        const snap = await getDoc(doc(db, "users", u.uid));
        const d = snap.data();
        const hasBasics =
          snap.exists() &&
          !!d?.username &&
          !!d?.weightKg &&
          !!d?.heightCm &&
          !!d?.age &&
          !!d?.sex;

        if (!hasBasics) {
          router.replace("/onboarding");
          return;
        }
      }
      setReady(true);
    });
    return () => off();
  }, [router, redirectTo, requireProfile]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
