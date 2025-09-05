"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { stripUndefinedDeep } from "@/utils/clean";

/* Simple client-side profanity filter */
const BAD_WORDS = ["fuck","shit","bitch","asshole","nigger","retard","cunt"];
function isClean(str) {
  if (!str) return true;
  const s = String(str).toLowerCase();
  return !BAD_WORDS.some(w => new RegExp(`\\b${w}\\b`, "i").test(s));
}

export default function DashboardPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setAuthed(true);
    });
    return () => stop();
  }, [router]);

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState("post"); // "post" | "recipe"

  // Post form
  const [pText, setPText] = useState("");
  const [pFile, setPFile] = useState(null);
  const [busyPost, setBusyPost] = useState(false);

  // Recipe form
  const [rTitle, setRTitle] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rSteps, setRSteps] = useState("");
  const [rIngredients, setRIngredients] = useState("");
  const [rFile, setRFile] = useState(null);
  const [busyRecipe, setBusyRecipe] = useState(false);

  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  if (!authed) return null;

  function parseIngredients(src) {
    return src
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [nameRaw, qtyRaw, unitRaw] = line.split("|").map(x => (x ?? "").trim());
        const name = nameRaw || "";
        const qtyParsed = qtyRaw ? Number(qtyRaw) : undefined;
        const unit = unitRaw || undefined;
        // IMPORTANT: do not return undefined fields — we’ll strip them below
        return { name, qty: qtyParsed, unit };
      });
  }

  async function createPost() {
    setMsg(null); setErr(null);

    if (!pText.trim() && !pFile) { setErr("Nothing to publish."); return; }
    if (!isClean(pText)) { setErr("Remove inappropriate words from the post."); return; }

    setBusyPost(true);
    try {
      const u = auth.currentUser;
      if (!u) { setErr("Please sign in again."); setBusyPost(false); return; }

      let imageURL = null;
      if (pFile) {
        const storageRef = ref(storage, `posts/${u.uid}/${Date.now()}`);
        await uploadBytes(storageRef, pFile);
        imageURL = await getDownloadURL(storageRef);
      }

      const raw = {
        uid: u.uid,
        text: pText.trim() || null,
        imageURL: imageURL ?? null,
        createdAt: serverTimestamp(),
      };

      const clean = stripUndefinedDeep(raw);
      await addDoc(collection(db, "posts"), clean);

      setMsg("Post published!");
      setPText(""); setPFile(null);
      setShowModal(false);
    } catch (e) {
      setErr(e?.message || "Failed to publish post.");
    } finally {
      setBusyPost(false);
    }
  }

  async function createRecipe() {
    setMsg(null); setErr(null);

    if (!rTitle.trim()) { setErr("Please enter a recipe title."); return; }
    if (!isClean(rTitle) || !isClean(rDesc) || !isClean(rSteps)) {
      setErr("Remove inappropriate words from title/description/steps.");
      return;
    }

    setBusyRecipe(true);
    try {
      const u = auth.currentUser;
      if (!u) { setErr("Please sign in again."); setBusyRecipe(false); return; }

      const ingredientsParsed = parseIngredients(rIngredients).map(it => {
        // build without undefined keys
        const base = { name: it.name };
        if (typeof it.qty === "number" && !Number.isNaN(it.qty)) base.qty = it.qty;
        if (it.unit) base.unit = it.unit;
        return base;
      });

      let imageURL = null;
      if (rFile) {
        // upload first so we can write doc once (also fine to write then update)
        const storageRef = ref(storage, `recipeImages/${u.uid}/${Date.now()}`);
        await uploadBytes(storageRef, rFile);
        imageURL = await getDownloadURL(storageRef);
      }

      const raw = {
        uid: u.uid,
        title: rTitle.trim(),
        description: rDesc.trim() || null,
        steps: rSteps.trim() || null,
        ingredients: ingredientsParsed,  // contains no undefined keys
        imageURL: imageURL ?? null,
        createdAt: serverTimestamp(),
      };

      const clean = stripUndefinedDeep(raw);
      await addDoc(collection(db, "recipes"), clean);

      setMsg("Recipe created! Check the Recipes page.");
      setRTitle(""); setRDesc(""); setRSteps(""); setRIngredients(""); setRFile(null);
      setShowModal(false);
    } catch (e) {
      setErr(e?.message || "Failed to create recipe.");
    } finally {
      setBusyRecipe(false);
    }
  }

  return (
    <main className="wrap">
      <h1 className="title">Dashboard</h1>

      {msg && <p className="ok">{msg}</p>}
      {err && <p className="bad">{err}</p>}

      <Card className="section">
        <h2 className="h2">Welcome 👋</h2>
        <p className="muted">
          Tap the <b>+</b> button to create a <b>Post</b> or a <b>Recipe</b>. Everyone can read them; only owners can edit/delete.
        </p>
      </Card>

      {/* Floating Action Button */}
      <button className="fab" onClick={() => setShowModal(true)} aria-label="Create">+</button>

      {/* Modal */}
      {showModal && (
        <div className="modalOverlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="tabs">
              <button className={`tab ${tab === "post" ? "active" : ""}`} onClick={() => setTab("post")}>Post</button>
              <button className={`tab ${tab === "recipe" ? "active" : ""}`} onClick={() => setTab("recipe")}>Recipe</button>
            </div>

            {tab === "post" ? (
              <div className="pane">
                <div className="field">
                  <label className="label">Text</label>
                  <textarea className="ta" rows={4} value={pText} onChange={(e) => setPText(e.target.value)} />
                  <small className="muted">Profanity is blocked.</small>
                </div>
                <div className="field">
                  <label className="label">Image (optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => setPFile(e.target.files?.[0] || null)} />
                </div>
                <div className="actions">
                  <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={createPost} disabled={busyPost}>{busyPost ? "Publishing…" : "Publish"}</Button>
                </div>
              </div>
            ) : (
              <div className="pane">
                <div className="grid">
                  <Input label="Title" value={rTitle} onChange={(e) => setRTitle(e.target.value)} />
                  <Input label="Short description" value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Ingredients (one per line: Name | qty | unit)</label>
                  <textarea className="ta" rows={4} value={rIngredients} onChange={(e) => setRIngredients(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Steps</label>
                  <textarea className="ta" rows={5} value={rSteps} onChange={(e) => setRSteps(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Image (optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => setRFile(e.target.files?.[0] || null)} />
                </div>
                <div className="actions">
                  <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={createRecipe} disabled={busyRecipe}>{busyRecipe ? "Creating…" : "Create"}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
        .section { margin-bottom: 20px; }
        .h2 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
        .muted { color: #6b7280; font-size: 14px; }

        .fab {
          position: fixed; right: 24px; bottom: 24px; width: 56px; height: 56px; border-radius: 50%;
          background: #111827; color: white; font-size: 28px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,.2);
          display: grid; place-items: center; cursor: pointer; transition: transform .12s, opacity .12s;
        }
        .fab:hover { transform: translateY(-2px); opacity: .95; }

        .modalOverlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); display: grid; place-items: center; padding: 16px; z-index: 50; }
        .modal { width: 100%; max-width: 720px; border-radius: 16px; background: white; border: 1px solid #e5e7eb; box-shadow: 0 20px 60px rgba(0,0,0,.2); padding: 16px; }

        .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .tab { border: 1px solid #e5e7eb; background: #f9fafb; color: #111827; padding: 8px 12px; border-radius: 999px; cursor: pointer; font-weight: 600; }
        .tab.active { background: #111827; color: #fff; border-color: #111827; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
        @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }

        .field { margin-bottom: 12px; }
        .label { display: block; margin-bottom: 6px; font-size: .9rem; color: #111827; font-weight: 500; }
        .ta { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 10px 12px; font-size: 14px; background: #fff; }
        .ta:focus { outline: none; border-color: #9ca3af; box-shadow: 0 0 0 4px rgba(17,24,39,.08); }
        .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }

        .ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
        .bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
      `}</style>
    </main>
  );
}
