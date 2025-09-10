"use client";

import { useEffect, useRef, useState } from "react";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc as fsDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

type Props = {
  recipeId: string;
  recipeUid: string;       // owner uid (from recipe document)
  canEdit: boolean;        // true only for owner in the edit page
};

type PhotoDoc = {
  id: string;
  url: string;
  createdAt?: any;
  storagePath?: string | null; // where it lives in Storage (for delete)
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
      (snap) => {
        setList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PhotoDoc[]
        );
        setErr(null);
      },
      (e) => setErr(e?.message ?? "Failed to load photos.")
    );
    return () => stop();
  }, [recipeId]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy(true);
    try {
      const farr = Array.from(files).slice(0, 12); // limit batch
      for (const f of farr) {
        // deterministic path: recipeImages/{uid}/{recipeId}/gallery/{timestamp}-{filename}
        const fname = `${Date.now()}-${f.name}`.replace(/\s+/g, "_");
        const storagePath = `recipeImages/${recipeUid}/${recipeId}/gallery/${fname}`;
        const sref = ref(storage, storagePath);
        await uploadBytes(sref, f);
        const url = await getDownloadURL(sref);
        await addDoc(collection(db, "recipes", recipeId, "photos"), {
          url,
          storagePath,
          createdAt: serverTimestamp(),
        });
      }
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: PhotoDoc) {
    setErr(null);
    setBusy(true);
    try {
      // delete storage file (if we know the path), ignore if missing
      if (p.storagePath) {
        try { await deleteObject(ref(storage, p.storagePath)); } catch {}
      }
      await deleteDoc(fsDoc(db, "recipes", recipeId, "photos", p.id));
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="rowHead">
        <h2 className="h2">Photos</h2>
        {canEdit && (
          <label className="btn">
            {busy ? "Working…" : "Add photos"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        )}
      </div>

      {err && <p className="bad">{err}</p>}

      {list.length === 0 ? (
        <p className="muted">{canEdit ? "No photos yet. Add some!" : "No photos yet."}</p>
      ) : (
        <ul className="grid">
          {list.map((p) => (
            <li key={p.id} className="card">
              <img className="img" src={p.url} alt="" />
              {canEdit && (
                <button className="tiny danger" onClick={() => remove(p)} disabled={busy}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .section { padding:16px 0; }
        .rowHead { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .h2 { font-size:18px; font-weight:700; margin:0; color:#0f172a; }
        .btn { border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; background:#fff; cursor:pointer; }
        .btn:hover { background:#f8fafc; }
        .bad { margin-top:8px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; }
        .muted { color:#64748b; font-size:14px; }
        .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:12px; list-style:none; margin:12px 0 0; padding:0; }
        .card { position:relative; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#fff; }
        .img { width:100%; height:160px; object-fit:cover; display:block; }
        .tiny { position:absolute; top:8px; right:8px; border:1px solid #e5e7eb; background:#fff; padding:4px 8px; border-radius:8px; font-size:12px; cursor:pointer; }
        .tiny.danger { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
      `}</style>
    </section>
  );
}
