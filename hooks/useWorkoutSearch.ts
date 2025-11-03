"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWorkoutSearch } from "@/lib/workouts/client";
import type { WorkoutContent, WorkoutSearchFilters, WorkoutSearchResponse } from "@/lib/workouts/types";

type State = {
  items: WorkoutContent[];
  meta: WorkoutSearchResponse["meta"] | null;
  loading: boolean;
  error: string | null;
};

function serializeFilters(filters: WorkoutSearchFilters): string {
  return JSON.stringify({
    q: filters.q?.trim() || "",
    bodyPart: filters.bodyPart || "",
    target: filters.target || "",
    equipment: filters.equipment || "",
  });
}

export function useWorkoutSearch(filters: WorkoutSearchFilters, options?: { limit?: number }) {
  const [state, setState] = useState<State>({ items: [], meta: null, loading: false, error: null });
  const filtersKey = useMemo(() => serializeFilters(filters), [filters]);
  const latestKey = useRef(filtersKey);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      latestKey.current = filtersKey;
      try {
        const res = await fetchWorkoutSearch(filters, { limit: options?.limit, offset: 0 });
        if (cancelled || latestKey.current !== filtersKey) return;
        setState({ items: res.items, meta: res.meta, loading: false, error: null });
      } catch (error) {
        if (cancelled || latestKey.current !== filtersKey) return;
        const message = error instanceof Error ? error.message : "Failed to load workouts";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [filters, filtersKey, options?.limit]);

  const loadMore = useCallback(async () => {
    if (!state.meta?.nextOffset) return;
    const currentKey = filtersKey;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetchWorkoutSearch(filters, {
        limit: options?.limit,
        offset: state.meta.nextOffset,
      });
      if (latestKey.current !== currentKey) return;
      setState((prev) => ({
        items: [...prev.items, ...res.items],
        meta: res.meta,
        loading: false,
        error: null,
      }));
    } catch (error) {
      if (latestKey.current !== currentKey) return;
      const message = error instanceof Error ? error.message : "Failed to load workouts";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [filters, filtersKey, options?.limit, state.meta?.nextOffset]);

  return {
    items: state.items,
    meta: state.meta,
    loading: state.loading,
    error: state.error,
    hasMore: !!state.meta?.nextOffset,
    loadMore,
  };
}
