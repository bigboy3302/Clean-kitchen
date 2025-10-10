// app/profile/recipes/[id]/page.tsx
import { notFound } from "next/navigation";
import EditorClient from "./EditorClient";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";


function toPlain(value: any): any {
  if (value == null) return value;

  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof GeoPoint) return { lat: value.latitude, lng: value.longitude };
  if (value instanceof DocumentReference) return value.path;

  if (Array.isArray(value)) return value.map(toPlain);

  if (typeof value === "object") {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) obj[k] = toPlain(v);
    return obj;
  }

  return value;
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;

  const adminDb = await getAdminDb();

  
  const snap = await adminDb.doc(`recipes/${id}`).get();
  if (!snap.exists) return notFound();

  const data = toPlain({ id: snap.id, ...snap.data() });
  return <EditorClient initial={data as any} />;
}
