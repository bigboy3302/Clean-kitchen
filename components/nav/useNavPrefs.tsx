"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

export type NavPlacement = "header" | "top" | "bottom" | "floating";
export type NavOrderItem = "dashboard" | "pantry" | "recipes" | "fitness" | "profile";

export interface NavPrefs {
  placement?: NavPlacement;
  accent?: string | null;
  icon?: string | null;   // icon tint
  compact?: boolean;
  glow?: boolean;
  order?: NavOrderItem[];
}

export interface UserPrefs {
  units?: "metric" | "imperial";
  theme?: "system" | "light" | "dark";
  emailNotifications?: boolean;
  nav?: NavPrefs;
}

export const defaultNavPrefs: Required<
  Pick<NavPrefs, "placement" | "accent" | "icon" | "compact" | "glow" | "order">
> = {
  placement: "header",
  accent: "var(--primary)",
  icon: "#ffffff",
  compact: false,
  glow: true,
  order: ["dashboard", "pantry", "recipes", "fitness", "profile"],
};

type ReturnShape = {
  uid: string | null;
  nav: NavPrefs | null;
  loading: boolean;
  error: unknown;
  save: (partial: NavPrefs) => Promise<void>;
  replace: (next: NavPrefs) => Promise<void>;
};

/**
 * Uses your initialized singletons { auth, db } from lib/firebase.
 * Avoids the app/no-app error by never calling getAuth()/getFirestore() directly here.
 */
export default function useNavPrefs(): ReturnShape {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [nav, setNav] = useState<NavPrefs | null>(null);
  const [loading, setLoading] = useState<boolean>(!!uid);
  const [error, setError] = useState<unknown>(null);

  // Watch auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // Subscribe to user nav prefs
  useEffect(() => {
    if (!uid) {
      setNav(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { prefs?: UserPrefs } | undefined;
        setNav(data?.prefs?.nav ?? null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  const save = useCallback(
    async (partial: NavPrefs) => {
      if (!uid) throw new Error("Not signed in");
      await setDoc(doc(db, "users", uid), { prefs: { nav: partial } }, { merge: true });
    },
    [uid]
  );

  const replace = useCallback(
    async (next: NavPrefs) => {
      if (!uid) throw new Error("Not signed in");
      await setDoc(doc(db, "users", uid), { prefs: { nav: next } }, { merge: true });
    },
    [uid]
  );

  return { uid, nav, loading, error, save, replace };
}
