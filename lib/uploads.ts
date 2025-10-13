// lib/uploads.ts
import { ref as sref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

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
