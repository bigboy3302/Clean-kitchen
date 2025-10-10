"use client";

import { useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";


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
