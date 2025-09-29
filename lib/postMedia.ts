import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

type AddMediaArgs = {
  uid: string;
  postId: string;
  files: File[];
  limit?: number;
};

export async function addMediaToPost({ uid, postId, files, limit = 4 }: AddMediaArgs) {
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error("Post not found.");

  const toUpload = files.slice(0, limit);
  for (const file of toUpload) {
    const isVideo = file.type.startsWith("video");
    const safeName = `${Date.now()}-${(file.name || "file").replace(/\s+/g, "_")}`;
    const path = `posts/${uid}/${postId}/${safeName}`;
    const storageRef = ref(storage, path);

    const task = uploadBytesResumable(storageRef, file);
    await new Promise<string>((resolve, reject) => {
      task.on("state_changed", undefined, reject, async () => {
        resolve(await getDownloadURL(storageRef));
      });
    }).then(async (url) => {
      const mediaItem = {
        mid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: isVideo ? "video" : "image",
        url
      };
      await updateDoc(postRef, { media: arrayUnion(mediaItem) });
    });
  }
}
