export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import data from "@/data/workouts.json";

type RawWorkout = {
  id?: string;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  gifUrl?: string;
  description?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipmentList?: string[];
  instructions?: unknown;
};

type ApiWorkout = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  description: string;
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  descriptionHtml: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentList: string[];
  instructions: string[];
};

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const workouts = Array.isArray(data) ? (data as RawWorkout[]) : [];

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : typeof item === "number" ? String(item) : ""))
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function matchesCaseInsensitive(source: string | undefined, filter: string | null): boolean {
  if (!filter) return true;
  if (!source) return false;
  return source.toLowerCase() === filter.trim().toLowerCase();
}

function includesQuery(workout: RawWorkout, query: string | null): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    workout.name?.toLowerCase().includes(q) ||
    workout.bodyPart?.toLowerCase().includes(q) ||
    workout.target?.toLowerCase().includes(q)
  );
}

function normalizeWorkout(raw: RawWorkout): ApiWorkout {
  const id = raw.id && String(raw.id).trim().length ? String(raw.id).trim() : crypto.randomUUID();
  const name = raw.name?.trim() || "Exercise";
  const bodyPart = raw.bodyPart?.trim() || raw.target?.trim() || "full body";
  const target = raw.target?.trim() || raw.bodyPart?.trim() || "full body";
  const equipment = raw.equipment?.trim() || "body weight";
  const gifUrl = raw.gifUrl?.trim() || "";

  const instructions = toStringArray(raw.instructions);
  const description =
    instructions.length > 0
      ? instructions.join(" ")
      : raw.description?.trim() || "Follow the GIF demo.";

  const descriptionHtml =
    instructions.length > 0
      ? instructions.map((step) => `<p>${escapeHtml(step)}</p>`).join("")
      : `<p>${escapeHtml(description)}</p>`;

  const primaryMuscles = toStringArray(raw.primaryMuscles);
  const secondaryMuscles = toStringArray(raw.secondaryMuscles);

  const equipmentList = toStringArray(raw.equipmentList);
  if (equipmentList.length === 0 && equipment) {
    equipmentList.push(equipment);
  }

  const image = gifUrl || null;

  return {
    id,
    name,
    bodyPart,
    target,
    equipment,
    gifUrl,
    description,
    imageUrl: image,
    imageThumbnailUrl: image,
    descriptionHtml,
    primaryMuscles: primaryMuscles.length ? primaryMuscles : target ? [target] : [],
    secondaryMuscles,
    equipmentList,
    instructions,
  };
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(0, Math.floor(parsed));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bodyPart = searchParams.get("bodyPart");
    const target = searchParams.get("target");
    const query = searchParams.get("q");
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));

    const filtered = workouts.filter(
      (workout) =>
        matchesCaseInsensitive(workout.bodyPart, bodyPart) &&
        matchesCaseInsensitive(workout.target, target) &&
        includesQuery(workout, query)
    );

    const slice = filtered.slice(offset, offset + limit);
    const shaped = slice.map(normalizeWorkout);

    return new Response(JSON.stringify(shaped), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/workouts failed:", error);
    const message = error instanceof Error && error.message ? error.message : "Server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
