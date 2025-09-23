// lib/upload.ts
import { auth, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export type UploadedMedia = {
  url: string;          // HTTPS download URL
  storagePath: string;  // the path we can later delete
};

export async function uploadPostImage(opts: {
  uid: string;
  postId: string;
  file: File;
  onProgress?: (pct: number) => void;
}): Promise<UploadedMedia> {
  const { uid, postId, file, onProgress } = opts;

  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Not authorized to upload for this user.");
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `posts/${uid}/${postId}/${Date.now()}-${safeName}`;
  const r = ref(storage, storagePath);

  const task = uploadBytesResumable(r, file);
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          onProgress(pct);
        }
      },
      reject,
      () => resolve()
    );
  });

  const url = await getDownloadURL(task.snapshot.ref);
  return { url, storagePath };
}
