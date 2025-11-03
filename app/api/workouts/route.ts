export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import data from "@/data/workouts.json";
import { WorkoutSchema } from "@/lib/validation/workout";
import { getAdminDb } from "@/lib/firebaseAdmin";

type RawLocalWorkout = {
  id?: string;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  gifUrl?: string;
  imageUrl?: string | null;
  imageThumbnailUrl?: string | null;
  description?: string;
  descriptionHtml?: string;
  primaryMuscles?: unknown;
  secondaryMuscles?: unknown;
  equipmentList?: unknown;
  instructions?: unknown;
};

type FirestoreWorkoutDoc = {
  name?: unknown;
  bodyPart?: unknown;
  target?: unknown;
  equipment?: unknown;
  gifUrl?: unknown;
  instructions?: unknown;
  visibility?: unknown;
  ownerId?: unknown;
  likes?: unknown;
  verified?: unknown;
  description?: unknown;
  createdAt?: unknown;
};

export type NormalizedWorkout = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  description: string;
  descriptionHtml: string;
  instructions: string[];
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentList: string[];
  visibility: "public" | "private";
  ownerId: string | null;
  likes: number;
  verified: boolean;
  createdAt: string | null;
  source: "local" | "user";
};

type DecodedUser = {
  uid: string;
};

const LOCAL_LIMIT = 400;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;

let localCache: NormalizedWorkout[] | null = null;

const arrayFromUnknown = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number") return String(item);
      return "";
    })
    .filter(Boolean);
};

const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function toIsoTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  return null;
}

function buildDescription(instructions: string[], fallback?: string | null): { text: string; html: string } {
  if (instructions.length) {
    const html = instructions.map((step) => `<p>${htmlEscape(step)}</p>`).join("");
    const text = instructions.join(" ");
    return { text, html };
  }
  const safeText = (fallback?.trim() || "Follow the GIF demo.") ?? "Follow the GIF demo.";
  return { text: safeText, html: `<p>${htmlEscape(safeText)}</p>` };
}

function ensureBodyPart(value: string | undefined): string {
  if (!value) return "full body";
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "full body";
}

function normalizeLocalWorkout(raw: RawLocalWorkout): NormalizedWorkout {
  const id = raw.id?.toString().trim() || crypto.randomUUID();
  const name = raw.name?.toString().trim() || "Exercise";
  const bodyPart = ensureBodyPart(raw.bodyPart?.toString());
  const target = ensureBodyPart(raw.target?.toString());
  const equipment = raw.equipment?.toString().trim() || "body weight";
  const gifUrl = raw.gifUrl?.toString().trim() || "";

  const instructions = arrayFromUnknown(raw.instructions);
  const { text: description, html: descriptionHtml } = buildDescription(instructions, raw.description);

  const primaryMuscles = arrayFromUnknown(raw.primaryMuscles);
  const secondaryMuscles = arrayFromUnknown(raw.secondaryMuscles);
  const equipmentList = arrayFromUnknown(raw.equipmentList);
  if (!equipmentList.length && equipment) equipmentList.push(equipment);

  const imageUrl = raw.imageUrl?.toString().trim() || gifUrl || null;
  const imageThumbnailUrl = raw.imageThumbnailUrl?.toString().trim() || imageUrl;

  return {
    id,
    name,
    bodyPart,
    target,
    equipment,
    gifUrl,
    description,
    descriptionHtml,
    instructions,
    imageUrl,
    imageThumbnailUrl,
    primaryMuscles: primaryMuscles.length ? primaryMuscles : target ? [target] : [],
    secondaryMuscles,
    equipmentList,
    visibility: "public",
    ownerId: null,
    likes: 0,
    verified: true,
    createdAt: null,
    source: "local",
  };
}

function normalizeUserWorkout(id: string, raw: FirestoreWorkoutDoc): NormalizedWorkout | null {
  const nameRaw = typeof raw.name === "string" ? raw.name : "";
  const name = nameRaw.trim();
  if (!name) return null;

  const bodyPart = ensureBodyPart(typeof raw.bodyPart === "string" ? raw.bodyPart : undefined);
  const target = ensureBodyPart(typeof raw.target === "string" ? raw.target : undefined);
  const equipment = typeof raw.equipment === "string" && raw.equipment.trim() ? raw.equipment.trim() : "body weight";
  const gifUrl = typeof raw.gifUrl === "string" ? raw.gifUrl.trim() : "";
  const instructions = arrayFromUnknown(raw.instructions);
  const { text: description, html: descriptionHtml } = buildDescription(
    instructions,
    typeof raw.description === "string" ? raw.description : undefined
  );

  const visibility =
    raw.visibility === "private" || raw.visibility === "public" ? (raw.visibility as "public" | "private") : "public";

  const imageUrl = gifUrl || null;

  return {
    id,
    name,
    bodyPart,
    target,
    equipment,
    gifUrl,
    description,
    descriptionHtml,
    instructions,
    imageUrl,
    imageThumbnailUrl: imageUrl,
    primaryMuscles: [],
    secondaryMuscles: [],
    equipmentList: equipment ? [equipment] : [],
    visibility,
    ownerId: typeof raw.ownerId === "string" ? raw.ownerId : null,
    likes: typeof raw.likes === "number" ? raw.likes : 0,
    verified: !!raw.verified,
    createdAt: toIsoTimestamp(raw.createdAt),
    source: "user",
  };
}

async function getLocalWorkouts(): Promise<NormalizedWorkout[]> {
  if (localCache) return localCache;
  const subset = Array.isArray(data) ? data.slice(0, LOCAL_LIMIT) : [];
  localCache = subset.map((entry) => normalizeLocalWorkout(entry as RawLocalWorkout));
  return localCache;
}

async function getPublicUserWorkouts(): Promise<NormalizedWorkout[]> {
  try {
    const db = await getAdminDb();
    const snap = await db
      .collection("workouts")
      .where("visibility", "==", "public")
      .limit(400)
      .get();
    return snap.docs
      .map((doc) => normalizeUserWorkout(doc.id, doc.data() as FirestoreWorkoutDoc))
      .filter((item): item is NormalizedWorkout => !!item);
  } catch (error) {
    console.error("[workouts] Failed to load public workouts from Firestore:", error);
    return [];
  }
}

function applyFilters(
  items: NormalizedWorkout[],
  filters: {
    q?: string | null;
    bodyPart?: string | null;
    target?: string | null;
    equipment?: string | null;
  }
) {
  const q = filters.q?.trim().toLowerCase();
  const bodyPart = filters.bodyPart?.trim().toLowerCase();
  const target = filters.target?.trim().toLowerCase();
  const equipment = filters.equipment?.trim().toLowerCase();

  return items.filter((item) => {
    if (bodyPart && item.bodyPart.toLowerCase() !== bodyPart) return false;
    if (target && item.target.toLowerCase() !== target) return false;
    if (equipment && item.equipment.toLowerCase() !== equipment) return false;
    if (q) {
      const haystack = [
        item.name,
        item.bodyPart,
        item.target,
        item.equipment,
        item.description,
        item.instructions.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.floor(parsed));
}

async function getAuthUser(req: NextRequest): Promise<DecodedUser | null> {
  const header = req.headers.get("authorization") || "";
  const matches = header.match(/^Bearer (.+)$/i);
  if (!matches) return null;
  const token = matches[1]?.trim();
  if (!token) return null;
  try {
    const db = await getAdminDb();
    const { getAuth } = await import("firebase-admin/auth");
    const adminAuth = getAuth(db.app);
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (error) {
    console.warn("[workouts] Failed to verify ID token", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q");
    const bodyPart = searchParams.get("bodyPart");
    const target = searchParams.get("target");
    const equipment = searchParams.get("equipment");
    const limit = parseLimit(searchParams.get("limit"));
    const page = parsePage(searchParams.get("page"));

    const [publicWorkouts, localWorkouts] = await Promise.all([getPublicUserWorkouts(), getLocalWorkouts()]);

    const mergedMap = new Map<string, NormalizedWorkout>();
    for (const item of [...publicWorkouts, ...localWorkouts]) {
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    }

    const filtered = applyFilters(Array.from(mergedMap.values()), { q, bodyPart, target, equipment });
    const total = filtered.length;

    const start = (page - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);
    const hasNext = start + pageItems.length < total;

    return NextResponse.json(
      {
        items: pageItems,
        page,
        total,
        hasNext,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("GET /api/workouts failed:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = WorkoutSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const instructions = (payload.instructions ?? []).map((step) => step.trim()).filter(Boolean);
    const visibility = payload.visibility ?? "public";
    const name = payload.name.trim();
    const bodyPart = payload.bodyPart.trim();
    const target = payload.target.trim();
    const equipment = payload.equipment.trim();
    const gifUrl = payload.gifUrl?.trim() || "";

    const db = await getAdminDb();
    const { FieldValue } = await import("firebase-admin/firestore");

    const docRef = await db.collection("workouts").add({
      name,
      nameLower: name.toLowerCase(),
      bodyPart,
      bodyPartLower: bodyPart.toLowerCase(),
      target,
      targetLower: target.toLowerCase(),
      equipment,
      equipmentLower: equipment.toLowerCase(),
      gifUrl: gifUrl || null,
      instructions,
      visibility,
      ownerId: user.uid,
      likes: 0,
      verified: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const normalized = normalizeUserWorkout(docRef.id, {
      name,
      bodyPart,
      target,
      equipment,
      gifUrl,
      instructions,
      visibility,
      ownerId: user.uid,
      likes: 0,
      verified: false,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(normalized, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts failed:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
