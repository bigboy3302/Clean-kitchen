"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebas1e";

type UseAuthResult = {
  user: User | null;
  loading: boolean;
};

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser ?? null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
