const EXERCISES_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

type Entry = { id: string; name: string; images: string[] };

let lookup: Map<string, string> | null = null;
let pending: Promise<Map<string, string>> | null = null;

const STOP = new Set(["and", "with", "a", "the", "of", "on", "in", "at", "to", "for", "from", "by", "or", "is", "as"]);

function norm(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sigWords(normalized: string): string[] {
  return normalized.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
}

async function buildLookup(): Promise<Map<string, string>> {
  try {
    const res = await fetch(EXERCISES_JSON, { next: { revalidate: 86400 } });
    if (!res.ok) return new Map();
    const data: Entry[] = await res.json();
    const map = new Map<string, string>();
    for (const ex of data) {
      if (ex.images?.length) map.set(norm(ex.name), ex.id);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function getLookup(): Promise<Map<string, string>> {
  if (lookup) return lookup;
  if (!pending) {
    pending = buildLookup().then((m) => {
      lookup = m;
      return m;
    });
  }
  return pending;
}

function makeUrls(id: string) {
  return { main: `${IMAGE_BASE}/${id}/0.jpg`, alt: `${IMAGE_BASE}/${id}/1.jpg` };
}

export async function getExerciseImages(exerciseName: string): Promise<{ main: string; alt: string } | null> {
  const map = await getLookup();
  const q = norm(exerciseName);

  // Tier 1: exact
  const exact = map.get(q);
  if (exact) return makeUrls(exact);

  const qWords = q.split(" ").filter(Boolean);
  const qSig = sigWords(q);

  // Tier 2: all query words appear in candidate
  let allMatch: { id: string; extra: number } | null = null;
  for (const [candidate, id] of map) {
    const cw = candidate.split(" ");
    if (qWords.every((w) => cw.includes(w))) {
      const extra = cw.length - qWords.length;
      if (!allMatch || extra < allMatch.extra) allMatch = { id, extra };
    }
  }
  if (allMatch) return makeUrls(allMatch.id);

  // Tier 3: best significant-word overlap (score = matched / query sig words)
  if (qSig.length === 0) return null;
  let bestId = "";
  let bestScore = 0;
  for (const [candidate, id] of map) {
    const cSig = new Set(sigWords(candidate));
    const overlap = qSig.filter((w) => cSig.has(w)).length;
    if (overlap === 0) continue;
    const score = overlap / qSig.length;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  if (bestScore >= 0.4) return makeUrls(bestId);

  return null;
}
