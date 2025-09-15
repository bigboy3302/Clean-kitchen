// lib/hardDelete.ts
import { db, storage } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { ref as sref, deleteObject } from "firebase/storage";

type MediaItem = { storagePath?: string };

/**
 * Fast client-side delete:
 * - batch delete subcollections (likes/reposts/comments)
 * - delete only recorded media files (skip slow listAll sweep)
 * - delete post doc last
 */
export async function hardDeletePost(postId: string, uid: string, media?: MediaItem[]) {
  // 1) read all subcollections in parallel
  const [likesSnap, repostsSnap, commentsSnap] = await Promise.all([
    getDocs(collection(db, "posts", postId, "likes")),
    getDocs(collection(db, "posts", postId, "reposts")),
    getDocs(collection(db, "posts", postId, "comments")),
  ]);

  // 2) single writeBatch commit for all subcollection docs
  const batch = writeBatch(db);
  likesSnap.forEach((d) => batch.delete(d.ref));
  repostsSnap.forEach((d) => batch.delete(d.ref));
  commentsSnap.forEach((d) => batch.delete(d.ref));
  const subcollectionsCommit = batch.commit();

  // 3) delete recorded media paths in parallel (ignore missing)
  const mediaDeletes = Array.isArray(media)
    ? media
        .filter((m): m is { storagePath: string } => !!m?.storagePath)
        .map((m) => deleteObject(sref(storage, m.storagePath)).catch(() => {}))
    : [];

  await Promise.all([subcollectionsCommit, ...mediaDeletes]);

  // 4) delete the post doc
  await deleteDoc(doc(db, "posts", postId));
}
