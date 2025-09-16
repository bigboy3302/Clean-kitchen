import { db, storage } from "@/lib/firebase";
import { deleteDoc, doc, collection, getDocs } from "firebase/firestore";
import { ref as sref, listAll, deleteObject, StorageReference } from "firebase/storage";

type MediaItem = { storagePath?: string };

function toRef(path: string): StorageReference {
  return sref(storage, path);
}

async function deleteDirRecursively(dirRef: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(dirRef);
  await Promise.all(items.map((i) => deleteObject(i)));
  await Promise.all(prefixes.map((p) => deleteDirRecursively(p)));
}

export async function hardDeletePost(postId: string, uid: string, media?: MediaItem[]) {
  // remove subcollections
  for (const sub of ["likes", "reposts", "comments"] as const) {
    const snap = await getDocs(collection(db, "posts", postId, sub));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // delete recorded files
  if (Array.isArray(media)) {
    try {
      await Promise.all(
        media
          .filter((m): m is { storagePath: string } => !!m?.storagePath)
          .map((m) => deleteObject(toRef(m.storagePath)))
      );
    } catch {}
  }

  // sweep folder posts/{uid}/{postId}/
  try {
    const root = sref(storage, `posts/${uid}/${postId}/`);
    await deleteDirRecursively(root);
  } catch {}

  // delete the Firestore doc
  await deleteDoc(doc(db, "posts", postId));
}
