"use client";
import { useEffect } from "react";
import { auth, db } from "@/lib/firebas1e";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function EnsureUserDoc() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: u.uid,
            email: u.email ?? null,
            createdAt: serverTimestamp(),
            heightCm: null,
            weightKg: null,
            age: null,
            sex: null,
            activity: null,
            goal: "maintain",
          }, { merge: true });
        }
      } catch (e) {
        console.error("EnsureUserDoc failed", e);
      }
    });
    return () => unsub();
  }, []);
  return null;
}
