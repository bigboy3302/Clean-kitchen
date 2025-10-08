"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
  /** Raw value from Firestore (can be null if none saved yet) */
  nav: NavPrefs | null;
  /** Defaults merged with current nav (safe to render immediately) */
  effective: Required<NavPrefs>;
  loading: boolean;
  error: unknown;
  /**
   * Shallow update: only provided keys are changed, others in prefs.nav are preserved.
   * Example: save({ compact: true })
   */
  save: (partial: NavPrefs) => Promise<void>;
  /**
   * Replace entire prefs.nav with the provided object (use with care).
   */
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

  const effective = useMemo<Required<NavPrefs>>(() => {
    return {
      ...defaultNavPrefs,
      ...(nav ?? {}),
    };
  }, [nav]);

  const save = useCallback(
    async (partial: NavPrefs) => {
      if (!uid) throw new Error("Not signed in");
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(partial)) {
        updates[`prefs.nav.${k}`] = v;
      }
      await setDoc(doc(db, "users", uid), updates, { merge: true });
    },
    [uid]
  );

  const replace = useCallback(
    async (next: NavPrefs) => {
      if (!uid) throw new Error("Not signed in");
      await setDoc(
        doc(db, "users", uid),
        { prefs: { nav: next } },
        { merge: true }
      );
    },
    [uid]
  );

  return { uid, nav, effective, loading, error, save, replace };
}
