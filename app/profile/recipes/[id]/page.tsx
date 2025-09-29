"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import dynamic from "next/dynamic";



type Ingredient = { name: string; qty?: number | null; unit?: string | null };
type Author = { username?: string; displayName?: string; avatarURL?: string | null } | null;

type Recipe = {
  id: string;
  uid: string;
  title?: string | null;
  description?: string | null;
  steps?: string | null;
  imageURL?: string | null;
  ingredients?: Ingredient[];
  createdAt?: any;
  author?: Author;
};

function toDateSafe(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

function parseIngredients(src: string): Ingredient[] {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [nameRaw, qtyRaw, unitRaw] = line.split("|").map((x) => (x ?? "").trim());
      const name = nameRaw || "";
      const qty = qtyRaw ? Number(qtyRaw) : null;
      const unit = unitRaw || null;
      return { name, qty: Number.isFinite(qty as number) ? (qty as number) : null, unit };
    });
}

function formatIngredients(list?: Ingredient[] | null): string {
  if (!Array.isArray(list)) return "";
  return list
    .map((i) => {
      const name = (i?.name ?? "").trim();
      const qty = i?.qty ?? "";
      const unit = (i?.unit ?? "") || "";
      return [name, qty, unit].filter((p, idx) => (idx === 0 ? true : String(p).length > 0)).join(" | ");
    })
    .join("\n");
}

export default function RecipeEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [ings, setIngs] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setMe(u || null);
      setLoadingAuth(false);
    });
    return () => stop();
  }, []);

  useEffect(() => {
    if (!id) return;
    const refDoc = doc(db, "recipes", String(id));
    const stop = onSnapshot(
      refDoc,
      (snap) => {
        setLoadingDoc(false);
        if (!snap.exists()) {
          setRecipe(null);
          setErr("This recipe doesn’t exist (or was deleted).");
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) } as Recipe;
        setRecipe(data);
        setTitle(data.title || "");
        setDesc(data.description || "");
        setSteps(data.steps || "");
        setIngs(formatIngredients(data.ingredients));
        setErr(null);
      },
      (e) => {
        setLoadingDoc(false);
        setErr(e?.message ?? "Could not load recipe.");
      }
    );
    return () => stop();
  }, [id]);

  
  useEffect(() => {
    if (loadingAuth || loadingDoc) return;
    if (!recipe) return;
    if (!me || recipe.uid !== me.uid) {
      router.replace(`/recipes/${id}`);
    }
  }, [loadingAuth, loadingDoc, me, recipe, id, router]);

  const created = toDateSafe(recipe?.createdAt);
  const authorName = useMemo(() => {
    const a = recipe?.author || {};
    return (a as any)?.username || (a as any)?.displayName || recipe?.uid?.slice(0, 6) || "Unknown";
  }, [recipe]);

  async function saveChanges() {
    if (!recipe || !me) return;
    setErr(null);
    setMsg(null);

    if (!title.trim()) {
      setErr("Please add a title.");
      return;
    }

    const payload: any = {
      title: title.trim(),
      description: desc.trim() || null,
      steps: steps.trim() || null,
      ingredients: parseIngredients(ings).filter(i => (i?.name || "").trim().length > 0),
      updatedAt: serverTimestamp(),
    };

    setBusy(true);
    try {
      await updateDoc(doc(db, "recipes", recipe.id), payload);
      setMsg("Saved!");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceImage() {
    if (!recipe || !me || !file) return;
    setErr(null); setMsg(null);
    setBusy(true);
    try {
     
      const path = `recipeImages/${recipe.uid}/${recipe.id}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await updateDoc(doc(db, "recipes", recipe.id), { imageURL: url, updatedAt: serverTimestamp() });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg("Image updated!");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update image.");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    if (!recipe || !me) return;
    setErr(null); setMsg(null);
    setBusy(true);
    try {
      const path = `recipeImages/${recipe.uid}/${recipe.id}`;
      try { await deleteObject(ref(storage, path)); } catch {}
      await updateDoc(doc(db, "recipes", recipe.id), { imageURL: null, updatedAt: serverTimestamp() });
      setMsg("Image removed.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove image.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingAuth || loadingDoc) {
    return <main className="wrap"><div className="card">Loading…</div></main>;
  }
  if (!recipe || !me || recipe.uid !== me.uid) return null;

  return (
    <main className="wrap">
      <h1 className="title">Edit recipe</h1>

      {msg && <p className="ok">{msg}</p>}
      {err && <p className="bad">{err}</p>}

      <section className="card">
        <header className="head">
          <div className="meta">
            <div className="author">
              {recipe.author?.avatarURL ? (
                <img className="avatar" src={recipe.author.avatarURL} alt="" />
              ) : (
                <div className="avatar fallback">{authorName[0]?.toUpperCase() || "U"}</div>
              )}
              <span>
                by <strong>{authorName}</strong>
                {created ? <> • {created.toLocaleDateString()} {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</> : null}
              </span>
            </div>
            <div className="actions">
              <Link className="btn" href={`/recipes/${recipe.id}`}>View</Link>
              <Link className="btn" href="/recipes">All recipes</Link>
            </div>
          </div>
        </header>

        <div className="grid">
          <div className="full">
            <label className="label">Title</label>
            <input className="textInput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Best pasta ever" />
          </div>

          <div className="full">
            <label className="label">Short description</label>
            <textarea className="textArea" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="A quick, rich tomato pasta…" />
          </div>

          <div className="full">
            <label className="label">Ingredients (one per line — “Name | qty | unit”)</label>
            <textarea className="textArea mono" rows={6} value={ings} onChange={(e) => setIngs(e.target.value)} placeholder={"Tomato | 2 | pcs\nOlive oil | 1 | tbsp\nSalt"} />
          </div>

          <div className="full">
            <label className="label">Steps</label>
            <textarea className="textArea" rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"1) Chop tomatoes\n2) Heat oil\n3) Add salt…"} />
          </div>

          <div className="full">
            <label className="label">Image</label>

       

            {recipe.imageURL ? (
              <div className="imgRow">
                <img className="thumb" src={recipe.imageURL} alt="" />
                <div className="col">
                  <div className="rowBtns">
                    <label className="btn">
                      Choose new
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button className="btn danger" onClick={removeImage} disabled={busy}>Remove image</button>
                    <button className="btn primary" onClick={replaceImage} disabled={!file || busy}>
                      {busy ? "Uploading…" : "Replace image"}
                    </button>
                  </div>
                  {file ? <div className="muted">Selected: {file.name}</div> : null}
                </div>
              </div>
            ) : (
              <div className="rowBtns">
                <label className="btn">
                  Choose image
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button className="btn primary" onClick={replaceImage} disabled={!file || busy}>
                  {busy ? "Uploading…" : "Upload"}
                </button>
                {file ? <div className="muted">Selected: {file.name}</div> : null}
              </div>
            )}
          </div>
        </div>

        <div className="actions end">
          <button className="btn" onClick={() => router.push(`/recipes/${recipe.id}`)}>Cancel</button>
          <button className="btn primary" onClick={saveChanges} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 800; margin-bottom: 12px; }
        .ok  { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; border-radius:8px; padding:8px 10px; font-size:13px; margin-bottom:10px; }
        .bad { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; margin-bottom:10px; }
        .card { border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(2,6,23,.04); }
        .head { padding-bottom:10px; border-bottom:1px solid #eef2f7; margin-bottom:12px; }
        .meta { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .author { display:flex; align-items:center; gap:10px; color:#475569; }
        .avatar { width:34px; height:34px; border-radius:999px; object-fit:cover; border:1px solid #e2e8f0; }
        .avatar.fallback { width:34px; height:34px; border-radius:999px; display:grid; place-items:center; background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #e2e8f0; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px 16px; }
        .full { grid-column: 1 / -1; }
        @media (max-width: 860px){ .grid { grid-template-columns: 1fr; } }
        .label { display:block; margin-bottom:6px; font-weight:600; color:#0f172a; }
        .textInput, .textArea { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; background:#fff; font-size:14px; }
        .textArea { min-height: 100px; }
        .textArea.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
        .imgRow { display:flex; gap:12px; align-items:flex-start; }
        .thumb { width:220px; height:160px; object-fit:cover; border:1px solid #e5e7eb; border-radius:12px; }
        .col { display:flex; flex-direction:column; gap:8px; }
        .rowBtns { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .actions { display:flex; gap:10px; }
        .actions.end { justify-content:flex-end; }
        .btn { border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; background:#fff; cursor:pointer; }
        .btn:hover { background:#f8fafc; }
        .btn.primary { background:#0f172a; color:#fff; border-color:#0f172a; }
        .btn.primary:hover { opacity:.95; }
        .btn.danger { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
        .muted { color:#64748b; font-size:12px; }
      `}</style>
    </main>
  );
}
