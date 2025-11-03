"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteSavedWorkout, fetchSavedWorkouts, saveWorkout } from "@/lib/workouts/client";
import type { SaveWorkoutPayload, SavedWorkoutRecord } from "@/lib/workouts/types";

type Kind = "me" | "public";

export function useSavedWorkouts(kind: Kind) {
  const [items, setItems] = useState<SavedWorkoutRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSavedWorkouts(kind);
      if (!mountedRef.current) return;
      setItems(list);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load saved workouts";
      setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const removeLocal = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const upsertLocal = useCallback((record: SavedWorkoutRecord) => {
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
  }, []);

  const handleSave = useCallback(async (payload: SaveWorkoutPayload) => {
    const saved = await saveWorkout(payload);
    upsertLocal(saved);
    return saved;
  }, [upsertLocal]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSavedWorkout(id);
    removeLocal(id);
  }, [removeLocal]);

  return {
    items,
    loading,
    error,
    refresh: load,
    removeLocal,
    upsertLocal,
    save: handleSave,
    destroy: handleDelete,
  };
}
