import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export type AddMediaArgs = {
  uid: string;
  postId: string;
  files: File[];
  limit?: number;
  onProgress?: (p: number) => void;
};

type MediaItem = {
  url: string;
  type: "image" | "video";
  path: string;
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

  const totals = toUpload.map((f) => f.size);
  const totalBytesAll = totals.reduce((a, b) => a + b, 0) || 1;
  const transferredMap = new Map<number, number>(); 

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
    await updateDoc(postRef, {
      media: arrayUnion(...media),
      updatedAt: serverTimestamp(),
    });
  }
}
