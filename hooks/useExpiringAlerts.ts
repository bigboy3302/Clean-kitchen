"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  FirestoreError,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/firebase";

type TSLike =
  | { toDate?: () => Date; seconds?: number }
  | string
  | Date
  | null
  | undefined;

type RawPantryItem = {
  id: string;
  name: string;
  quantity?: number;
  expiresAt?: TSLike;
};

export type ExpiryAlert = {
  id: string;
  name: string;
  status: "expired" | "soon";
  expiresOn: Date;
  daysDiff: number;
};

function toDate(value: TSLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  if (typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  }
  return null;
}

export function useExpiringAlerts(daysAhead = 3) {
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<RawPantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "pantryItems"), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped: RawPantryItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            name: data?.name ?? "Unnamed item",
            quantity: data?.quantity ?? 0,
            expiresAt: data?.expiresAt ?? null,
          };
        });
        setItems(mapped);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setItems([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  const alerts = useMemo<ExpiryAlert[]>(() => {
    if (!items.length) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + daysAhead);

    const flagged: ExpiryAlert[] = [];

    items.forEach((item) => {
      const expiresOn = toDate(item.expiresAt);
      if (!expiresOn) return;
      const date = new Date(expiresOn);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 0) {
        flagged.push({
          id: item.id,
          name: item.name,
          status: "expired",
          expiresOn: date,
          daysDiff: diffDays,
        });
      } else if (diffDays <= daysAhead) {
        flagged.push({
          id: item.id,
          name: item.name,
          status: "soon",
          expiresOn: date,
          daysDiff: diffDays,
        });
      }
    });

    return flagged.sort((a, b) => a.expiresOn.getTime() - b.expiresOn.getTime());
  }, [items, daysAhead]);

  const expiredCount = alerts.filter((a) => a.status === "expired").length;
  const soonCount = alerts.filter((a) => a.status === "soon").length;

  return {
    alerts,
    loading,
    error,
    hasAlerts: alerts.length > 0,
    expiredCount,
    soonCount,
  };
}
