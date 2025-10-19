// app/profile/recipes/[id]/page.tsx
import { notFound } from "next/navigation";
import EditorClient from "./EditorClient";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { DocumentReference, GeoPoint, Timestamp } from "firebase-admin/firestore";

type PageProps = {
  params: { id: string };
};

type EditorClientProps = Parameters<typeof EditorClient>[0];
type EditorRecipe = EditorClientProps["initial"];
type EditorIngredients = NonNullable<EditorRecipe["ingredients"]>;
type EditorIngredient = EditorIngredients[number];
type EditorAuthor = EditorRecipe["author"];

type PlainValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | PlainValue[]
  | { [key: string]: PlainValue };

type PlainObject = { [key: string]: PlainValue };

const isPlainObjectValue = (value: PlainValue | undefined): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function toPlain(value: unknown): PlainValue {
  if (value === null || value === undefined) {
    return value as null | undefined;
  }
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof GeoPoint) {
    return { lat: value.latitude, lng: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return value.path;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toPlain(entry));
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object") {
    const result: PlainObject = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toPlain(entry);
    }
    return result;
  }
  return undefined;
}

const toNullableString = (value: PlainValue | undefined): string | null =>
  typeof value === "string" ? value : null;

const toIngredientList = (value: PlainValue | undefined): EditorRecipe["ingredients"] => {
  if (!Array.isArray(value)) return undefined;

  const list: EditorIngredient[] = [];
  for (const entry of value) {
    if (!isPlainObjectValue(entry)) continue;

    const nameValue = entry["name"];
    const measureValue = entry["measure"];

    const ingredient: EditorIngredient = {};
    if (typeof nameValue === "string") {
      ingredient.name = nameValue;
    }

    if (typeof measureValue === "string") {
      ingredient.measure = measureValue;
    } else if (typeof measureValue === "number" || typeof measureValue === "boolean") {
      ingredient.measure = String(measureValue);
    } else if (measureValue === null) {
      ingredient.measure = null;
    }

    list.push(ingredient);
  }

  return list.length ? list : [];
};

const toAuthor = (value: PlainValue | undefined): EditorAuthor => {
  if (!isPlainObjectValue(value)) return null;
  const uidValue = value["uid"];
  const nameValue = value["name"];
  const uid = typeof uidValue === "string" ? uidValue : null;
  const name = typeof nameValue === "string" ? nameValue : null;
  return { uid, name };
};

export default async function Page({ params }: PageProps) {
  const { id } = params;

  const adminDb = await getAdminDb();
  const snap = await adminDb.doc(`recipes/${id}`).get();
  if (!snap.exists) return notFound();

  const plain = toPlain({ id: snap.id, ...snap.data() });
  if (!isPlainObjectValue(plain)) return notFound();

  const base: Record<string, unknown> = { ...plain };

  const ingredients = toIngredientList(plain["ingredients"]);
  const author = toAuthor(plain["author"]);

  const initial: EditorRecipe = {
    ...base,
    id: typeof plain["id"] === "string" ? plain["id"] : snap.id,
    uid: toNullableString(plain["uid"]) ?? "",
    title: toNullableString(plain["title"]),
    image: toNullableString(plain["image"]),
    imageURL: toNullableString(plain["imageURL"]),
    category: toNullableString(plain["category"]),
    area: toNullableString(plain["area"]),
    ingredients,
    instructions: toNullableString(plain["instructions"]),
    author,
  };

  return <EditorClient initial={initial} />;
}
