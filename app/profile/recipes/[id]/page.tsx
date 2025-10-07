// app/profile/recipes/[id]/page.tsx
import { notFound } from "next/navigation";
import EditorClient from "./EditorClient";
import { getAdminDb } from "@/lib/firebaseAdmin";

function isTimestamp(v: any): v is { toDate: () => Date } { return v && typeof v.toDate === "function"; }
function isGeoPoint(v: any): v is { latitude: number; longitude: number } {
  return v && typeof v.latitude === "number" && typeof v.longitude === "number";
}
function isDocRef(v: any): v is { path: string } { return v && typeof v.path === "string"; }

function toPlain(value: any): any {
  if (value == null) return value;
  if (isTimestamp(value)) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (isGeoPoint(value)) return ({ lat: value.latitude, lng: value.longitude });
  if (isDocRef(value)) return value.path;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    const o: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) o[k] = toPlain(v);
    return o;
  }
  return value;
}

export default async function Page({ params }: { params: { id: string } }) {
  const adminDb = await getAdminDb();
  const snap = await adminDb.doc(`recipes/${params.id}`).get();
  if (!snap.exists) return notFound();
  const data = toPlain({ id: snap.id, ...snap.data() });
  return <EditorClient initial={data as any} />;
}
