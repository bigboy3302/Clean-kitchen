"use client";

import type { CollectionReference, DocumentData, Query, QueryDocumentSnapshot } from "firebase/firestore";
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebas1e";

export type UserDoc = {
  uid: string;
  email: string;
  username?: string | null;
  photoURL?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  prefs?: {
    units?: "metric" | "imperial";
    theme?: "system" | "light" | "dark" | "custom";
    palette?: {
      primary: string;
      primaryContrast: string;
      bg: string;
      bg2: string;
      text: string;
      muted: string;
      border: string;
      ring: string;
    } | null;
    emailNotifications?: boolean;
  };
};

export type AuthorUpdate = {
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  avatarURL?: string | null;
};

const PROFILE_BATCH_SIZE = 200;

export function slugifyUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/\.{2,}/g, ".").slice(0, 20);
}

export function validUsername(username: string) {
  return /^[a-z0-9._-]{3,20}$/.test(username);
}

export function fullName(firstName?: string | null, lastName?: string | null) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  return `${first} ${last}`.trim() || null;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function buildAuthorPatch(uid: string, info: AuthorUpdate) {
  const avatar = info.photoURL ?? info.avatarURL ?? null;
  return {
    "author.uid": uid,
    "author.username": info.username ?? null,
    "author.displayName": info.displayName ?? null,
    "author.avatarURL": avatar,
    "author.photoURL": avatar,
    "author.name": info.displayName ?? null,
  };
}

async function updateDocsInBatches(colRef: CollectionReference<DocumentData>, uid: string, info: AuthorUpdate) {
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  const patch = buildAuthorPatch(uid, info);

  while (true) {
    const base: Query<DocumentData> = cursor
      ? query(colRef, where("uid", "==", uid), orderBy("__name__"), startAfter(cursor), limit(PROFILE_BATCH_SIZE))
      : query(colRef, where("uid", "==", uid), orderBy("__name__"), limit(PROFILE_BATCH_SIZE));
    const snap = await getDocs(base);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      batch.set(docSnap.ref, patch, { merge: true });
    });
    await batch.commit();

    if (snap.size < PROFILE_BATCH_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

async function updateCollectionGroupInBatches(group: string, uid: string, info: AuthorUpdate) {
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  const patch = buildAuthorPatch(uid, info);

  while (true) {
    const base: Query<DocumentData> = cursor
      ? query(
          collectionGroup(db, group),
          where("uid", "==", uid),
          orderBy("__name__"),
          startAfter(cursor),
          limit(PROFILE_BATCH_SIZE)
        )
      : query(collectionGroup(db, group), where("uid", "==", uid), orderBy("__name__"), limit(PROFILE_BATCH_SIZE));
    const snap = await getDocs(base);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      batch.set(docSnap.ref, patch, { merge: true });
    });
    await batch.commit();

    if (snap.size < PROFILE_BATCH_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

export async function propagateUserProfile(uid: string, info: AuthorUpdate) {
  await updateDocsInBatches(collection(db, "posts"), uid, info);
  await updateDocsInBatches(collection(db, "recipes"), uid, info);
  await updateCollectionGroupInBatches("comments", uid, info);
  await updateCollectionGroupInBatches("replies", uid, info);
}
