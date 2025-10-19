
import { storage } from "@/lib/firebas1e";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadImage(file: File, path: string) {
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}
