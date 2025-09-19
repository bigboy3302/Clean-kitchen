// lib/HardDelete.ts
"use client";

import { auth, db, storage } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import {
  ref as sref,
  listAll,
  deleteObject,
  StorageReference,
} from "firebase/storage";

export type MediaItem = { storagePath?: string };

function toRef(path: string): StorageReference {
  return sref(storage, path);
}

async function deleteDirRecursively(dirRef: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(dirRef);
  await Promise.all(items.map((i) => deleteObject(i).catch(() => {})));
  await Promise.all(prefixes.map((p) => deleteDirRecursively(p)));
}

/** ---------- POSTS ---------- */
export async function hardDeletePost(
  postId: string,
  _postOwnerUidFromUI?: string,
  media?: MediaItem[]
) {
  const myUid = auth.currentUser?.uid || null;
  if (!myUid) throw new Error("not-signed-in");

  const postRef = doc(db, "posts", postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;

  const data = snap.data() as any;
  const owner = data?.uid as string | undefined;

  if (!owner) {
    throw new Error("permission-denied: post has no uid field (legacy).");
  }
  if (owner !== myUid) {
    throw new Error(`permission-denied: you (${myUid}) do not own this post (${owner}).`);
  }

  // clear subcollections while parent exists
  for (const sub of ["likes", "reposts", "comments"] as const) {
    try {
      const subSnap = await getDocs(collection(db, "posts", postId, sub));
      await Promise.all(subSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    } catch {}
  }

  // best-effort storage cleanup
  try {
    if (Array.isArray(media)) {
      await Promise.all(
        media
          .filter((m): m is { storagePath: string } => !!m?.storagePath)
          .map((m) => deleteObject(toRef(m.storagePath)).catch(() => {}))
      );
    }
    const root = sref(storage, `posts/${owner}/${postId}/`);
    await deleteDirRecursively(root).catch(() => {});
  } catch {}

  // delete doc
  await deleteDoc(postRef);
}

/** ---------- RECIPES ---------- */
export async function hardDeleteRecipe(recipeId: string) {
  const myUid = auth.currentUser?.uid || null;
  if (!myUid) throw new Error("not-signed-in");

  const ref = doc(db, "recipes", recipeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as any;
  const owner = data?.uid ?? data?.author?.uid ?? null;

  if (!owner) {
    // Rules require uid to authorize client delete
    throw new Error("permission-denied: recipe has no uid field (legacy).");
  }
  if (owner !== myUid) {
    throw new Error(`permission-denied: you (${myUid}) do not own this recipe (${owner}).`);
  }

  // clear photos subcollection first
  try {
    const photos = await getDocs(collection(db, "recipes", recipeId, "photos"));
    await Promise.all(photos.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  } catch {}

  // best-effort storage cleanup (covers cover + gallery)
  try {
    const root1 = sref(storage, `recipeImages/${owner}/${recipeId}`);
    await deleteDirRecursively(root1).catch(() => {});
    const root2 = sref(storage, `recipeImages/${owner}/${recipeId}/gallery/`);
    await deleteDirRecursively(root2).catch(() => {});
  } catch {}

  // delete doc
  await deleteDoc(ref);
}
