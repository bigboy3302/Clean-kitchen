
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

export type NavPlacement = "header" | "top" | "bottom" | "floating";
export type NavOrderItem = "dashboard" | "pantry" | "recipes" | "fitness" | "profile";

export interface NavPrefs {
  placement?: NavPlacement;
  accent?: string | null;
  icon?: string | null;   
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

export const defaultNavPrefs: Required<Pick<NavPrefs, "placement" | "accent" | "icon" | "compact" | "glow" | "order">> = {
  placement: "header",
  accent: "var(--primary)",
  icon: "#ffffff",
  compact: false,
  glow: true,
  order: ["dashboard", "pantry", "recipes", "fitness", "profile"],
};

export function useNavPrefs(db: Firestore) {
  const auth = useMemo(() => getAuth(), []);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [nav, setNav] = useState<NavPrefs | null>(null);
  const [loading, setLoading] = useState<boolean>(!!uid);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!uid) {
      setNav(null);
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [db, uid]);

  const save = useCallback(
    async (partial: NavPrefs) => {
      if (!uid) throw new Error("Not signed in");
      await setDoc(doc(db, "users", uid), { prefs: { nav: partial } }, { merge: true });
    },
    [db, uid]
  );

  const replace = useCallback(
    async (next: NavPrefs) => {
      if (!uid) throw new Error("Not signed in");
      await setDoc(doc(db, "users", uid), { prefs: { nav: next } }, { merge: true });
    },
    [db, uid]
  );

  return { uid, nav, loading, error, save, replace };
}


export default useNavPrefs;
