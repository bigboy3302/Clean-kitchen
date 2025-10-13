"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { addMediaToPost } from "@/lib/postMedia";

const MAX_IMAGE_DIMENSION = 1600;

async function optimiseImage(file: File, maxDim = MAX_IMAGE_DIMENSION): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const shouldSkip = file.size <= 350 * 1024; // keep small images untouched
  if (shouldSkip) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = objectUrl;
    });

    let { width, height } = img;
    if (width <= maxDim && height <= maxDim) return file;

    if (width > height) {
      height = Math.round((height / width) * maxDim);
      width = maxDim;
    } else {
      width = Math.round((width / height) * maxDim);
      height = maxDim;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? 0.82 : undefined)
    );
    if (!blob) return file;

    const base = file.name.replace(/\.\w+$/, "") || "image";
    const extension = outputType === "image/png" ? ".png" : ".jpg";
    const optimisedName = `${base}-optimised${extension}`;
    return new File([blob], optimisedName, { type: outputType, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PostComposer() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{url:string;type:"image"|"video"}[]>([]);
  const [pct, setPct] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []).slice(0, 4);
    if (!list.length) {
      setFiles([]);
      setPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      return;
    }

    const processed = await Promise.all(
      list.map(async (file) => (file.type.startsWith("image/") ? optimiseImage(file) : file))
    );
    const nextPreviews = processed.map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image",
    }));

    setFiles(processed);
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return nextPreviews;
    });
  }

  async function createPost() {
    setErr(null);
    const user = auth.currentUser;
    if (!user) { setErr("Please sign in."); return; }
    if (!text.trim() && files.length === 0) { setErr("Nothing to publish."); return; }

    setBusy(true);
    try {
      
      let author = { username: null as string|null, displayName: null as string|null, avatarURL: null as string|null };
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const u = snap.data() as any;
          author = {
            username: u?.username ?? null,
            displayName: u?.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : (u?.displayName ?? null),
            avatarURL: u?.photoURL ?? null,
          };
        }
      } catch {}

      const refDoc = await addDoc(collection(db, "posts"), {
        uid: user.uid,
        text: text.trim() || null,
        media: [],
        createdAt: serverTimestamp(),
        isRepost: false,
        author,
      });
      const postId = refDoc.id;

      if (files.length) {
        await addMediaToPost({
          uid: user.uid,
          postId,
          files,
          limit: 4,
          onProgress: (p) => setPct(Math.round(p*100)),
        });
      }

      setText("");
      setFiles([]);
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = "";
      setPct(0);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What's cooking?"
      />
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={onPick} />
      {previews.length > 0 && (
        <div className={`grid mcount-${previews.length}`}>
          {previews.map((m,i)=>(
            <div key={i} className="cell">{m.type==="video"?<video src={m.url} controls/>:<img src={m.url} alt=""/>}</div>
          ))}
        </div>
      )}
      {busy && (files.length>0) ? <div className="hint">Uploading… {pct}%</div> : null}
      {err ? <div className="err">{err}</div> : null}
      <button disabled={busy} onClick={createPost}>
        {busy ? "Posting…" : "Post"}
      </button>

      <style jsx>{`
        .composer { border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:12px; display:grid; gap:8px; }
        textarea { width:100%; border:1px solid #d1d5db; border-radius:10px; padding:8px 10px; }
        .grid { display:grid; gap:6px }
        .grid.mcount-1{ grid-template-columns:1fr; grid-auto-rows:160px }
        .grid.mcount-2{ grid-template-columns:1fr 1fr; grid-auto-rows:130px }
        .grid.mcount-3{ grid-template-columns:2fr 1fr; grid-auto-rows:110px }
        .grid.mcount-3 .cell:first-child{ grid-row:1 / span 2; height:226px }
        .grid.mcount-4{ grid-template-columns:1fr 1fr; grid-auto-rows:110px }
        .cell img, .cell video { width:100%; height:100%; object-fit:cover; display:block; border:1px solid #e5e7eb; border-radius:10px; background:#000 }
        .hint { font-size:12px; color:#64748b; }
        .err { color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:6px 8px; border-radius:8px; font-size:12px; }
        button { border:1px solid #0f172a; background:#0f172a; color:#fff; border-radius:10px; padding:6px 10px; cursor:pointer; }
        button[disabled] { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
