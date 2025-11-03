"use client";

import { useEffect, useState } from "react";
import { fetchWorkoutFilters } from "@/lib/workouts/client";

type FiltersState = {
  bodyParts: string[];
  equipment: string[];
  targets: string[];
};

const EMPTY: FiltersState = { bodyParts: [], equipment: [], targets: [] };

export function useWorkoutFilters() {
  const [data, setData] = useState<FiltersState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchWorkoutFilters()
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((err) => {
        if (!alive) return;
        const message = err instanceof Error ? err.message : "Failed to load filters";
        setError(message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { ...data, loading, error };
}
