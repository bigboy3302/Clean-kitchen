import { notFound } from "next/navigation";
import EditorClient from "./EditorClient";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";

/** Recursively convert Firestore Admin types to plain JSON */
function toPlain(value: any): any {
  if (value == null) return value;

  // Admin SDK types
  if (value instanceof Timestamp) return value.toDate().toISOString(); // or toMillis()
  if (value instanceof Date) return value.toISOString();
  if (value instanceof GeoPoint) return { lat: value.latitude, lng: value.longitude };
  if (value instanceof DocumentReference) return value.path;

  if (Array.isArray(value)) return value.map(toPlain);

  if (typeof value === "object") {
    // ensure plain prototype
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) obj[k] = toPlain(v);
    return obj;
  }

  return value; // primitives
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const snap = await adminDb.doc(`recipes/${id}`).get();
  if (!snap.exists) return notFound();

  // Make props JSON-serializable for the Client Component
  const data = toPlain({ id: snap.id, ...snap.data() });

  return <EditorClient initial={data as any} />;
}
