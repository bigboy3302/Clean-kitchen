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

/**
 * Hard delete under client rules:
 *  - Verify current user owns the post
 *  - Clear subcollections (needs parent to exist for rules)
 *  - Delete Storage (best-effort)
 *  - Delete the post doc (final, authoritative step)
 */
export async function hardDeletePost(
  postId: string,
  _postOwnerUidFromUI?: string,
  media?: MediaItem[]
) {
  const myUid = auth.currentUser?.uid || null;
  if (!myUid) throw new Error("not-signed-in");

  const postRef = doc(db, "posts", postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    // Already gone — nothing to do
    return;
  }

  const data = snap.data() as any;
  const owner = data?.uid as string | undefined;

  if (!owner) {
    // Your rules require resource.data.uid == request.auth.uid to delete
    throw new Error(
      "permission-denied: post has no uid field (legacy). Add uid or use admin cleanup."
    );
  }
  if (owner !== myUid) {
    throw new Error(
      `permission-denied: you (${myUid}) do not own this post (${owner}).`
    );
  }

  // 1) Clear subcollections FIRST (while parent exists)
  for (const sub of ["likes", "reposts", "comments"] as const) {
    try {
      const subSnap = await getDocs(collection(db, "posts", postId, sub));
      await Promise.all(subSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    } catch (e) {
      // best-effort; log quietly
      console.warn(`[hardDelete] could not clear ${sub}:`, (e as any)?.code || (e as any)?.message);
    }
  }

  // 2) Best-effort Storage cleanup
  try {
    if (Array.isArray(media)) {
      await Promise.all(
        media
          .filter((m): m is { storagePath: string } => !!m?.storagePath)
          .map((m) => deleteObject(toRef(m.storagePath)).catch(() => {}))
      );
    }
    // Sweep the folder posts/{owner}/{postId}/ (if you store uploads that way)
    const root = sref(storage, `posts/${owner}/${postId}/`);
    await deleteDirRecursively(root).catch(() => {});
  } catch {
    // ignore – Storage cleanup is best-effort
  }

  // 3) Finally delete the post document
  try {
    await deleteDoc(postRef);
  } catch (e: any) {
    // Quiet console; return a clear error to the UI
    const code = e?.code || e?.message || "permission-denied";
    throw new Error(code);
  }
}
