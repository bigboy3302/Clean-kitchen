// lib/hardDelete.ts
import { db, storage } from "@/lib/firebase";
import {
  deleteDoc, doc, collection, getDocs,
} from "firebase/firestore";
import { deleteObject, ref as sref, listAll } from "firebase/storage";

type MediaItem = {
  storagePath?: string;
};

export async function hardDeletePost(postId: string, uid: string, media?: MediaItem[]) {
  // 1) delete subcollections
  for (const sub of ["likes", "reposts", "comments"]) {
    const snap = await getDocs(collection(db, "posts", postId, sub));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }

  // 2) delete media files (by recorded storagePath)
  if (Array.isArray(media)) {
    await Promise.all(
      media
        .filter(m => m?.storagePath)
        .map(m => deleteObject(sref(storage, m!.storagePath!)))
    );
  }

  // (optional) safety: also nuke any stray files in the folder posts/{uid}/{postId}
  try {
    const folderRef = sref(storage, `posts/${uid}/${postId}`);
    const listing = await listAll(folderRef);
    await Promise.all(listing.items.map(it => deleteObject(it)));
  } catch (_) {}

  // 3) finally delete the post doc
  await deleteDoc(doc(db, "posts", postId));
}
