// lib/uploads.ts
import { ref as sref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebas1e";

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export async function uploadAvatarFile(userId: string, file: File) {
  if (!/image\/(png|jpe?g|webp)/i.test(file.type)) {
    throw new Error("Pick PNG/JPG/WEBP");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Max 5 MB");
  }

  const r = sref(storage, `avatars/${userId}/avatar.jpg`);
  await uploadBytes(r, file, {
    contentType: file.type,               // required for your Storage rules' isImage()
    cacheControl: "public, max-age=3600",
  });
  return await getDownloadURL(r);
}

export async function uploadWorkoutMedia(userId: string, file: File) {
  const isVideo = /^video\//i.test(file.type);
  const isImage = /^image\//i.test(file.type);
  if (!isVideo && !isImage) {
    throw new Error("Upload an image or video.");
  }

  const limit = isVideo ? 120 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > limit) {
    throw new Error(isVideo ? "Videos must be under 120 MB." : "Images must be under 20 MB.");
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() || (isVideo ? "mp4" : "jpg") : isVideo ? "mp4" : "jpg";
  const path = `workouts/${userId}/${Date.now()}-${randomId()}.${ext.toLowerCase()}`;
  const ref = sref(storage, path);
  await uploadBytes(ref, file, {
    contentType: file.type,
    cacheControl: "public, max-age=86400",
  });
  return await getDownloadURL(ref);
}
