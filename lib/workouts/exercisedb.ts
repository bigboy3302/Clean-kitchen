// lib/workouts/exercisedb.ts
const EXDB_BASE = "https://exercisedb.p.rapidapi.com";
const HOST = "exercisedb.p.rapidapi.com";
const KEY = process.env.EXERCISEDB_RAPIDAPI_KEY || "";

if (!KEY) console.warn("[ExerciseDB] Missing EXERCISEDB_RAPIDAPI_KEY in .env.local");

async function exFetch<T>(path: string): Promise<T> {
  const url = `${EXDB_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": HOST,
      "x-rapidapi-key": KEY,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `exercisedb-${res.status}`);
  }
  return (await res.json()) as T;
}

/** All body parts (e.g. "back", "chest", ...) */
export async function listBodyParts(): Promise<string[]> {
  const data = await exFetch<string[]>("/exercises/bodyPartList");
  return data.map(s => s.trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

export type ExerciseDbItem = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string; // CloudFront GIF
};

export async function fetchExercises(opts: {
  bodyPart?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<ExerciseDbItem[]> {
  const { bodyPart, search, limit = 12, offset = 0 } = opts;

  let list: ExerciseDbItem[] = [];
  if (search && search.trim().length) {
    list = await exFetch<ExerciseDbItem[]>(`/exercises?name=${encodeURIComponent(search.trim())}`);
  } else if (bodyPart && bodyPart.trim().length) {
    list = await exFetch<ExerciseDbItem[]>(
      `/exercises/bodyPart/${encodeURIComponent(bodyPart.trim())}`
    );
  } else {
    list = await exFetch<ExerciseDbItem[]>("/exercises");
  }

  const start = Math.max(0, offset);
  const end = start + Math.max(1, limit);
  return list.slice(start, end);
}
