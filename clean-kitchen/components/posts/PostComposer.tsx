// components/posts/PostComposer.tsx
"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { uploadPostImage } from "@/lib/upload";

export default function PostComposer() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createPost() {
    setErr(null);
    const user = auth.currentUser;
    if (!user) {
      setErr("Please sign in.");
      return;
    }

    setBusy(true);
    try {
      // 1) create an empty post doc to get a postId
      const docRef = await addDoc(collection(db, "posts"), {
        uid: user.uid,
        text: text.trim() || null,
        createdAt: serverTimestamp(),
        media: [],
      });
      const postId = docRef.id;

      let mediaArr: any[] = [];
      if (file) {
        // 2) upload the image
        const uploaded = await uploadPostImage({
          uid: user.uid,
          postId,
          file,
          onProgress: (p) => setPct(p),
        });
        // 3) attach media entry to the post (simple approach: update after add)
        mediaArr = [
          {
            type: "image",
            url: uploaded.url,
            storagePath: uploaded.storagePath,
          },
        ];
        // keep it simple: just set media array with another write
        await import("firebase/firestore").then(async ({ updateDoc, doc }) => {
          await updateDoc(doc(db, "posts", postId), { media: mediaArr });
        });
      }

      // reset form
      setText("");
      setFile(null);
      setPct(0);
      alert("Post created!");
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
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file ? <div className="hint">{file.name}</div> : null}
      {busy && file ? <div className="hint">Uploading… {pct}%</div> : null}
      {err ? <div className="err">{err}</div> : null}
      <button disabled={busy} onClick={createPost}>
        {busy ? "Posting…" : "Post"}
      </button>

      <style jsx>{`
        .composer { border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:12px; display:grid; gap:8px; }
        textarea { width:100%; border:1px solid #d1d5db; border-radius:10px; padding:8px 10px; }
        .hint { font-size:12px; color:#64748b; }
        .err { color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:6px 8px; border-radius:8px; font-size:12px; }
        button { border:1px solid #0f172a; background:#0f172a; color:#fff; border-radius:10px; padding:6px 10px; cursor:pointer; }
        button[disabled] { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
