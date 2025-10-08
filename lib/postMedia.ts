// lib/postMedia.ts
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export type AddMediaArgs = {
  uid: string;
  postId: string;
  files: File[];
  /** Max number of files allowed (default: 4) */
  limit?: number;
  /** Overall progress, as a fraction 0..1 across all files */
  onProgress?: (p: number) => void;
};

type MediaItem = {
  url: string;
  type: "image" | "video";
  path: string; // storage path
  // You can add width/height/duration later if you extract them client-side
};

export async function addMediaToPost({
  uid,
  postId,
  files,
  limit = 4,
  onProgress,
}: AddMediaArgs) {
  if (!uid) throw new Error("Missing uid");
  if (!postId) throw new Error("Missing postId");
  if (!files?.length) return;

  const toUpload = files.slice(0, limit);

  // Track aggregate progress across all files
  const totals = toUpload.map((f) => f.size);
  const totalBytesAll = totals.reduce((a, b) => a + b, 0) || 1;
  const transferredMap = new Map<number, number>(); // fileIndex -> bytesTransferred

  const media: MediaItem[] = [];

  await Promise.all(
    toUpload.map(async (file, i) => {
      const isVideo = file.type.startsWith("video");
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const objectName = `${Date.now()}-${i}.${ext}`;
      const objectPath = `users/${uid}/posts/${postId}/${objectName}`;
      const storageRef = ref(storage, objectPath);

      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      });

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            transferredMap.set(i, snap.bytesTransferred);
            if (onProgress) {
              const transferredAll = Array.from(transferredMap.values()).reduce((a, b) => a + b, 0);
              onProgress(Math.min(1, transferredAll / totalBytesAll));
            }
          },
          (err) => reject(err),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              media.push({
                url,
                type: isVideo ? "video" : "image",
                path: objectPath,
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          }
        );
      });
    })
  );

  if (media.length) {
    const postRef = doc(db, "posts", postId);
    // If you want to append to an existing array:
    await updateDoc(postRef, {
      media: arrayUnion(...media),
      updatedAt: serverTimestamp(),
    });
    // If you prefer to replace media array entirely, do:
    // await updateDoc(postRef, { media, updatedAt: serverTimestamp() });
  }
}
