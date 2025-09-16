import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { ref as sref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

export type MediaItem = {
  mid: string;
  type: "image" | "video";
  url: string;
  storagePath: string;
  w?: number;
  h?: number;
  aspect?: number;
  duration?: number;
};

export type AddMediaToPostOptions = {
  uid: string;
  postId: string;
  files: File[];
  limit?: number;
  onProgress?: (p: number) => void;
  maxImageBytes?: number;
  maxVideoBytes?: number;
};

const ALLOWED_IMAGE = new Set(["image/jpeg","image/png","image/webp","image/gif","image/svg+xml","image/avif"]);
const ALLOWED_VIDEO = new Set(["video/mp4","video/webm","video/ogg"]);
const DEFAULT_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2000;

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID() as string;
  return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}
function classify(file: File): "image" | "video" | "reject" {
  if (ALLOWED_IMAGE.has(file.type) || file.type.startsWith("image/")) return "image";
  if (ALLOWED_VIDEO.has(file.type) || file.type.startsWith("video/")) return "video";
  return "reject";
}
function safeName(name: string) {
  return name.replace(/[^\w.\-()+@]/g, "_");
}
function getImageDims(file: File): Promise<{w:number;h:number}> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => rej(new Error("img meta fail"));
    img.src = URL.createObjectURL(file);
  });
}
function getVideoDims(file: File): Promise<{w:number;h:number;duration:number}> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { res({ w: v.videoWidth, h: v.videoHeight, duration: v.duration }); URL.revokeObjectURL(v.src); };
    v.onerror = () => rej(new Error("video meta fail"));
    v.src = URL.createObjectURL(file);
  });
}
async function maybeCompressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml" || file.type === "image/avif") return file;

  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = bad; img.src = url; });

  const w = img.naturalWidth, h = img.naturalHeight, longest = Math.max(w,h);
  if (longest <= MAX_IMAGE_EDGE) { URL.revokeObjectURL(url); return file; }

  const scale = MAX_IMAGE_EDGE/longest, cw = Math.round(w*scale), ch = Math.round(h*scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d"); if (!ctx) { URL.revokeObjectURL(url); return file; }
  ctx.drawImage(img, 0, 0, cw, ch);

  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/webp", 0.9));
  URL.revokeObjectURL(url);
  if (!blob) return file;

  const newName = file.name.replace(/\.[a-z0-9]+$/i, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}

export async function addMediaToPost(opts: AddMediaToPostOptions): Promise<MediaItem[]> {
  if (typeof window === "undefined") throw new Error("client only");

  const { uid, postId, files, limit = 4, onProgress, maxImageBytes = DEFAULT_MAX_IMAGE_BYTES, maxVideoBytes = DEFAULT_MAX_VIDEO_BYTES } = opts;
  const postRef = doc(db, "posts", postId);

  const selected = Array.from(files).slice(0, limit);
  const uploaded: MediaItem[] = [];
  const totalBytes = selected.reduce((a,f)=>a+(f.size||0),0)||1;
  let uploadedBytes = 0;

  for (let i=0;i<selected.length;i++) {
    let file = selected[i];
    const kind = classify(file);
    if (kind === "reject") { console.warn("skip unsupported:", file.type||file.name); continue; }
    const isVideo = kind === "video";

    if (isVideo) {
      if (file.size > maxVideoBytes) { console.warn("skip large video:", file.name); continue; }
    } else {
      if (file.size > maxImageBytes) file = await maybeCompressImage(file);
      if (file.size > maxImageBytes) { console.warn("skip large image:", file.name); continue; }
    }

    let w=0,h=0,duration: number|undefined;
    try {
      if (isVideo) { const d=await getVideoDims(file); w=d.w; h=d.h; duration=d.duration; }
      else { const d=await getImageDims(file); w=d.w; h=d.h; }
    } catch {}

    const filename = `${Date.now()}-${safeName(file.name)}`;
    const storagePath = `posts/${uid}/${postId}/${filename}`;
    const fileRef = sref(storage, storagePath);

    await new Promise<void>((resolve,reject)=>{
      const task = uploadBytesResumable(fileRef, file);
      task.on("state_changed",
        (snap)=>{
          const current = snap.bytesTransferred;
          const cumulative = uploadedBytes + current;
          onProgress?.(Math.min(1, cumulative / totalBytes));
        },
        (err)=>reject(err ?? new Error("upload failed")),
        ()=>resolve()
      );
    });

    uploadedBytes += file.size || 0;
    const url = await getDownloadURL(fileRef);

    uploaded.push({
      mid: uuid(),
      type: isVideo ? "video" : "image",
      url,
      storagePath,
      w, h,
      aspect: h ? Number((w/h).toFixed(5)) : undefined,
      ...(isVideo?{duration}:{}),
    });
  }

  if (uploaded.length > 0) await updateDoc(postRef, { media: arrayUnion(...uploaded) });
  onProgress?.(1);
  return uploaded;
}

export async function removeMediaFromPost(opts: { postId: string; item: MediaItem; }) {
  const { postId, item } = opts;
  const postRef = doc(db, "posts", postId);

  if (item.storagePath) await deleteObject(sref(storage, item.storagePath)).catch(()=>{});
  await updateDoc(postRef, { media: arrayRemove(item) });
}

export async function removeMediaFromPostByMid(opts: { postId: string; mid: string; }) {
  const { postId, mid } = opts;
  const postRef = doc(db, "posts", postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;
  const data = snap.data() || {};
  const media: MediaItem[] = Array.isArray(data.media) ? data.media : [];
  const keep = media.filter((m)=>m?.mid !== mid);

  const removed = media.find((m)=>m?.mid === mid);
  if (removed?.storagePath) await deleteObject(sref(storage, removed.storagePath)).catch(()=>{});
  await updateDoc(postRef, { media: keep });
}
