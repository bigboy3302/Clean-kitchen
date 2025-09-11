"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, deleteDoc, doc as fsDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

type PhotoDoc = {
  id: string;
  url: string;
  storagePath: string;
  createdAt?: any;
};

type Props = {
  recipeId: string;
  recipeUid: string;     // the owner uid stored on recipe doc
  canEdit: boolean;      // only owner can edit
};

export default function RecipePhotos({ recipeId, recipeUid, canEdit }: Props) {
  const [list, setList] = useState<PhotoDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // live gallery
  useEffect(() => {
    const q = query(
      collection(db, "recipes", recipeId, "photos"),
      orderBy("createdAt", "desc")
    );
    const stop = onSnapshot(
      q,
      (snap) => setList(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
      (e) => setErr(e?.message ?? "Failed to load photos.")
    );
    return () => stop();
  }, [recipeId]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy(true);

    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      if (u.uid !== recipeUid) throw new Error("You’re not the owner of this recipe.");

      const farr = Array.from(files).slice(0, 12);
      await Promise.all(
        farr.map(async (f) => {
          const fname = `${Date.now()}-${f.name}`.replace(/\s+/g, "_");
          const storagePath = `recipeImages/${recipeUid}/${recipeId}/gallery/${fname}`;
          const sRef = ref(storage, storagePath);

          await uploadBytes(sRef, f);                        // Storage rules
          const url = await getDownloadURL(sRef);

          await addDoc(collection(db, "recipes", recipeId, "photos"), {  // Firestore rules
            url,
            storagePath,
            createdAt: serverTimestamp(),
          });
        })
      );

      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      const msg = String(e?.code || e?.message || e);
      if (msg.includes("permission") || msg.includes("denied") || msg.includes("insufficient")) {
        setErr("You don’t have permission to add photos to this recipe (are you signed in as the owner?).");
      } else {
        setErr(e?.message ?? "Upload failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(p: PhotoDoc) {
    setErr(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      if (u.uid !== recipeUid) throw new Error("You’re not the owner of this recipe.");

      // delete from storage first (best-effort)
      if (p.storagePath) {
        await deleteObject(ref(storage, p.storagePath));
      }
      // then delete the photo doc
      await deleteDoc(fsDoc(db, "recipes", recipeId, "photos", p.id));
    } catch (e: any) {
      const msg = String(e?.code || e?.message || e);
      if (msg.includes("permission") || msg.includes("denied") || msg.includes("insufficient")) {
        setErr("You don’t have permission to delete this photo.");
      } else {
        setErr(e?.message ?? "Delete failed.");
      }
    }
  }

  return (
    <section className="photosWrap">
      <div className="photosHead">
        <h2 className="h2">Photos</h2>
        {canEdit && (
          <label className="uploadBtn">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => upload(e.target.files)}
              hidden
            />
            <span>{busy ? "Uploading…" : "Add photos"}</span>
          </label>
        )}
      </div>

      {err && <p className="bad">{err}</p>}

      {list.length === 0 ? (
        <p className="muted">{canEdit ? "No photos yet. Upload a few!" : "No photos yet."}</p>
      ) : (
        <div className="grid">
          {list.map((p) => (
            <figure key={p.id} className="item">
              <img src={p.url} alt="" className="img" />
              {canEdit && (
                <button className="del" onClick={() => removePhoto(p)} aria-label="Delete">
                  ✕
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      <style jsx>{`
        .photosWrap { margin-top: 16px; }
        .photosHead { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .h2 { font-size:18px; font-weight:700; color:#0f172a; margin:0; }
        .uploadBtn { border:1px solid #e5e7eb; border-radius:10px; background:#fff; padding:8px 12px; cursor:pointer; }
        .uploadBtn:hover { background:#f8fafc; }
        .bad { margin-top:8px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; }
        .muted { color:#6b7280; font-size:14px; margin-top:8px; }
        .grid { margin-top:10px; display:grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap:10px; }
        .item { position:relative; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin:0; }
        .img { width:100%; height:160px; object-fit:cover; display:block; }
        .del {
          position:absolute; top:6px; right:6px; width:28px; height:28px; border-radius:999px; border:none;
          background:rgba(15,23,42,.9); color:#fff; cursor:pointer;
        }
        .del:hover { opacity:.9; }
      `}</style>
    </section>
  );
}
