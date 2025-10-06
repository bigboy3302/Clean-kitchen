"use client";

import { useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/** Mount this once globally (e.g., in app/layout.tsx) to ensure a users/{uid} doc exists */
export default function EnsureUserDoc() {
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    (async () => {
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: u.uid,
          email: u.email ?? null,
          createdAt: serverTimestamp(),
          // place-holders for metrics (you may already fill these elsewhere)
          heightCm: null,
          weightKg: null,
          age: null,
          sex: null,
          activity: null,
          goal: "maintain",
        }, { merge: true });
      }
    })();
  }, []);

  return null;
}
