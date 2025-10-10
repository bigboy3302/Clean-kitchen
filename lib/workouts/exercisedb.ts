export type ExerciseDbItem = {
  id: string;            
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;        
};

function headers() {
  const key = process.env.RAPIDAPI_EXERCISE_KEY!;
  const host = process.env.RAPIDAPI_EXERCISE_HOST || "exercisedb.p.rapidapi.com";
  if (!key) throw new Error("Missing RAPIDAPI_EXERCISE_KEY");
  return {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": host,
  };
}

async function fetchJSON<T>(path: string): Promise<T> {
  const base = `https://${process.env.RAPIDAPI_EXERCISE_HOST || "exercisedb.p.rapidapi.com"}`;
  const res = await fetch(`${base}${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `exerciseDB-${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listTargets(): Promise<string[]> {
  return fetchJSON<string[]>(`/exercises/targetList`);
}

export async function listBodyParts(): Promise<string[]> {
  return fetchJSON<string[]>(`/exercises/bodyPartList`);
}

export async function fetchExercises(options: {
  search?: string | null;
  target?: string | null;
  bodyPart?: string | null;
  limit?: number;
  offset?: number;
}): Promise<ExerciseDbItem[]> {
  const { search, target, bodyPart, limit = 12, offset = 0 } = options || {};
  let list: ExerciseDbItem[];

  if (search) {
   
    list = await fetchJSON<ExerciseDbItem[]>(`/exercises/name/${encodeURIComponent(search)}`);
  } else if (target) {
    list = await fetchJSON<ExerciseDbItem[]>(`/exercises/target/${encodeURIComponent(target)}`);
  } else if (bodyPart) {
    list = await fetchJSON<ExerciseDbItem[]>(`/exercises/bodyPart/${encodeURIComponent(bodyPart)}`);
  } else {
    list = await fetchJSON<ExerciseDbItem[]>(`/exercises`);
  }

  const start = Math.max(0, Number(offset) || 0);
  const end = start + Math.max(1, Math.min(40, Number(limit) || 12));
  return list.slice(start, end);
}
