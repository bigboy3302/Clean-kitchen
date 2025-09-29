
import { storage } from "@/lib/firebase"; 
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuid } from "uuid";

export function coverPath(uid: string, recipeId: string) {
  return `recipeImages/${uid}/${recipeId}/cover`;
}
export function galleryPath(uid: string, recipeId: string, imageId: string) {
  return `recipeImages/${uid}/${recipeId}/gallery/${imageId}`;
}

export async function uploadRecipeCover(uid: string, recipeId: string, file: File) {
  const r = ref(storage, coverPath(uid, recipeId));
  await uploadBytes(r, file, { contentType: file.type });
  return await getDownloadURL(r);
}

export async function uploadRecipeGalleryImage(uid: string, recipeId: string, file: File) {
  const id = uuid();
  const r = ref(storage, galleryPath(uid, recipeId, id));
  await uploadBytes(r, file, { contentType: file.type });
  const url = await getDownloadURL(r);
  return { id, url };
}

export async function deleteRecipeGalleryImage(uid: string, recipeId: string, id: string) {
  const r = ref(storage, galleryPath(uid, recipeId, id));
  await deleteObject(r);
}
