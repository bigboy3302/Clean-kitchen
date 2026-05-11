"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebas1e";
import { doc, updateDoc, serverTimestamp, deleteDoc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";
import BookWritingLoader from "./BookWritingLoader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type RecipeDoc = {
  id: string;
  uid: string;
  title?: string | null;
  image?: string | null;
  imageURL?: string | null;
  category?: string | null;
  area?: string | null;
  ingredients?: { name?: string; measure?: string | null }[];
  instructions?: string | null;
  author?: { uid?: string | null; name?: string | null } | null;
  timeMinutes?: number | null;
  servings?: number | null;
};

type Ingredient = { name: string; amount: string };

const CATEGORIES = [
  "Beef","Breakfast","Chicken","Dessert","Goat","Lamb","Miscellaneous",
  "Pasta","Pork","Seafood","Side","Starter","Vegan","Vegetarian",
];

function toIngredientRows(list?: RecipeDoc["ingredients"]): Ingredient[] {
  if (!Array.isArray(list) || list.length === 0) return [{ name: "", amount: "" }];
  const rows = list.map((it) => ({ name: (it?.name ?? "").trim(), amount: (it?.measure ?? "").trim() })).filter((r) => r.name);
  return rows.length ? rows : [{ name: "", amount: "" }];
}

function parseSteps(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines : [""];
}

export default function EditorClient({ initial }: { initial: RecipeDoc | null }) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => { setMe(u || null); setAuthReady(true); });
    return () => stop();
  }, []);

  const [recipe, setRecipe] = useState<RecipeDoc | null>(initial);
  const [loadingRecipe, setLoadingRecipe] = useState(!initial);

  // form fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "" }]);
  const [steps, setSteps] = useState<string[]>([""]);

  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const ownerUid = recipe?.uid || null;
  const isOwner = useMemo(() => !!me && !!ownerUid && me.uid === ownerUid, [me, ownerUid]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecipe() {
      if (!id || initial) return;
      setLoadingRecipe(true);
      try {
        const snap = await getDoc(doc(db, "recipes", String(id)));
        if (!snap.exists()) { if (!cancelled) setErr("Recipe not found."); return; }
        if (!cancelled) { setRecipe({ id: snap.id, ...(snap.data() as Omit<RecipeDoc, "id">) }); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load recipe.");
      } finally {
        if (!cancelled) setLoadingRecipe(false);
      }
    }
    void loadRecipe();
    return () => { cancelled = true; };
  }, [id, initial]);

  useEffect(() => {
    if (!recipe) return;
    setTitle(recipe.title || "");
    setCategory(recipe.category || "");
    setArea(recipe.area || "");
    setCover(recipe.image || recipe.imageURL || null);
    setMinutes(String(recipe.timeMinutes ?? ""));
    setServings(String(recipe.servings ?? ""));
    setIngredients(toIngredientRows(recipe.ingredients));
    setSteps(parseSteps((recipe.instructions || "").trim()));
  }, [recipe]);

  /* ── image upload ── */
  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file || !me?.uid || !id) { if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setUploadBusy(true);
    try {
      const path = `recipeImages/${me.uid}/${id}/cover`;
      const storageRef = sref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "recipes", String(id)), { image: url, updatedAt: serverTimestamp() });
      setCover(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to upload cover.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onRemoveCover() {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "recipes", String(id)), { image: null, updatedAt: serverTimestamp() });
      setCover(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to remove cover.");
    } finally { setSaving(false); }
  }

  /* ── ingredient helpers ── */
  const updateIngredient = (i: number, field: keyof Ingredient, val: string) =>
    setIngredients((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  const addIngredient = () => setIngredients((prev) => [...prev, { name: "", amount: "" }]);
  const removeIngredient = (i: number) =>
    setIngredients((prev) => prev.length === 1 ? [{ name: "", amount: "" }] : prev.filter((_, idx) => idx !== i));

  /* ── step helpers ── */
  const updateStep = (i: number, val: string) =>
    setSteps((prev) => prev.map((s, idx) => idx === i ? val : s));
  const addStep = () => setSteps((prev) => [...prev, ""]);
  const removeStep = (i: number) =>
    setSteps((prev) => prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i));

  /* ── save ── */
  async function save() {
    if (!id || !isOwner) return;
    if (!title.trim()) { setErr("Recipe title is required."); return; }
    setSaving(true);
    setErr(null);
    try {
      const parsedIngredients = ingredients
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), measure: r.amount.trim() || null }));
      const minutesNum = minutes.trim() ? Number(minutes) : null;
      const servingsNum = servings.trim() ? Number(servings) : null;
      await updateDoc(doc(db, "recipes", String(id)), {
        title: title.trim(),
        titleLower: title.trim().toLowerCase(),
        category: category.trim() || null,
        area: area.trim() || null,
        ingredients: parsedIngredients,
        instructions: steps.filter(Boolean).join("\n") || null,
        timeMinutes: Number.isFinite(minutesNum) ? minutesNum : null,
        servings: Number.isFinite(servingsNum) ? servingsNum : null,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally { setSaving(false); }
  }

  async function doDelete() {
    if (!id || !isOwner || deleting) return;
    setDeleteErr(null);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "recipes", String(id)));
      setConfirmOpen(false);
      router.push("/recipes");
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Failed to delete.");
    } finally { setDeleting(false); }
  }

  if (!authReady || loadingRecipe) return <BookWritingLoader variant="flip" />;

  if (!recipe) return (
    <main className="ek-shell">
      <div className="ek-err">{err || "Recipe not found."}</div>
      <Link className="ek-backBtn" href="/recipes">← Back to recipes</Link>
      <style jsx>{css}</style>
    </main>
  );

  if (!isOwner) return (
    <main className="ek-shell">
      <div className="ek-err">You don&apos;t have permission to edit this recipe.</div>
      <Link className="ek-backBtn" href={`/recipes/${id}`}>View recipe</Link>
      <style jsx>{css}</style>
    </main>
  );

  const isBusy = saving || uploadBusy;

  return (
    <main className="ek-shell">
      {/* top bar */}
      <div className="ek-topBar">
        <Link href="/recipes" className="ek-backBtn">← Back</Link>
        <div className="ek-topTitle">Edit Recipe</div>
        <div className="ek-topActions">
          {saved && <span className="ek-savedBadge">✓ Saved</span>}
          <button className="ek-btn ek-btnPrimary" onClick={save} disabled={isBusy}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {err && <div className="ek-err">{err}</div>}

      <div className="ek-layout">
        {/* LEFT: image + basic info */}
        <div className="ek-leftCol">

          {/* cover image */}
          <div className="ek-card">
            <div className="ek-cardHead">
              <span className="ek-eye">Cover photo</span>
              <h2 className="ek-cardTitle">Recipe image</h2>
            </div>
            <div className="ek-coverWrap">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={title || "cover"} className="ek-coverImg" />
              ) : (
                <div className="ek-coverPh">
                  <span>No photo yet</span>
                  <span className="ek-coverSub">Upload one below</span>
                </div>
              )}
              {uploadBusy && <div className="ek-uploadOverlay">Uploading…</div>}
            </div>
            <div className="ek-imgActions">
              <label className="ek-btn ek-btnSecondary ek-uploadLabel">
                {cover ? "Change photo" : "Upload photo"}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickCover} hidden />
              </label>
              {cover && (
                <button className="ek-btn ek-btnGhost ek-btnDanger" type="button" onClick={onRemoveCover} disabled={isBusy}>
                  Remove
                </button>
              )}
            </div>
            <p className="ek-hint">Upload a photo from your device. JPG or PNG recommended.</p>
          </div>

          {/* basic info */}
          <div className="ek-card">
            <div className="ek-cardHead">
              <span className="ek-eye">Required</span>
              <h2 className="ek-cardTitle">Basic info</h2>
            </div>

            <div className="ek-field">
              <label className="ek-lbl">Recipe title <span className="ek-req">*</span></label>
              <input className="ek-inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chicken Alfredo" />
            </div>

            <div className="ek-row2">
              <div className="ek-field">
                <label className="ek-lbl">Cook time (min)</label>
                <input className="ek-inp" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="30" />
              </div>
              <div className="ek-field">
                <label className="ek-lbl">Servings</label>
                <input className="ek-inp" type="number" min={0} value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
              </div>
            </div>

            <div className="ek-row2">
              <div className="ek-field">
                <label className="ek-lbl">Category</label>
                <select className="ek-inp" value={CATEGORIES.includes(category) ? category : category ? "__custom" : ""} onChange={(e) => { if (e.target.value !== "__custom") setCategory(e.target.value); }}>
                  <option value="">— select —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  {category && !CATEGORIES.includes(category) && <option value="__custom">{category}</option>}
                </select>
                {category && !CATEGORIES.includes(category) && (
                  <input className="ek-inp" style={{ marginTop: 6 }} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Custom category" />
                )}
              </div>
              <div className="ek-field">
                <label className="ek-lbl">Cuisine</label>
                <input className="ek-inp" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Italian" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: ingredients + steps */}
        <div className="ek-rightCol">

          {/* ingredients */}
          <div className="ek-card">
            <div className="ek-cardHead">
              <span className="ek-eye">What you need</span>
              <h2 className="ek-cardTitle">Ingredients</h2>
            </div>
            <p className="ek-hint" style={{ marginBottom: 10 }}>Add each ingredient with a name and optional amount.</p>

            <div className="ek-ingrHeader">
              <span />
              <span className="ek-colLabel">Ingredient</span>
              <span className="ek-colLabel">Amount (optional)</span>
              <span />
            </div>
            <div className="ek-ingrList">
              {ingredients.map((row, i) => (
                <div key={i} className="ek-ingrRow">
                  <span className="ek-rowNum">{i + 1}</span>
                  <input className="ek-inp" value={row.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="e.g. Chicken breast" />
                  <input className="ek-inp" value={row.amount} onChange={(e) => updateIngredient(i, "amount", e.target.value)} placeholder="e.g. 200g" />
                  <button type="button" className="ek-removeBtn" onClick={() => removeIngredient(i)} title="Remove ingredient">×</button>
                </div>
              ))}
            </div>
            <button type="button" className="ek-addBtn" onClick={addIngredient}>+ Add ingredient</button>
          </div>

          {/* steps */}
          <div className="ek-card">
            <div className="ek-cardHead">
              <span className="ek-eye">How to make it</span>
              <h2 className="ek-cardTitle">Cooking steps</h2>
            </div>
            <p className="ek-hint" style={{ marginBottom: 10 }}>Write each step below. They will be numbered automatically on the recipe page.</p>

            <div className="ek-stepList">
              {steps.map((step, i) => (
                <div key={i} className="ek-stepRow">
                  <div className="ek-stepNum">{i + 1}</div>
                  <textarea className="ek-inp ek-ta" rows={2} value={step} onChange={(e) => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}: describe what to do…`} />
                  <button type="button" className="ek-removeBtn" onClick={() => removeStep(i)} title="Remove step">×</button>
                </div>
              ))}
            </div>
            <button type="button" className="ek-addBtn" onClick={addStep}>+ Add step</button>
          </div>
        </div>
      </div>

      {/* sticky bottom bar */}
      <div className="ek-bottomBar">
        {(err || deleteErr) && <span className="ek-errInline">{err || deleteErr}</span>}
        {saved && <span className="ek-savedBadge">✓ Saved</span>}
        <div style={{ flex: 1 }} />
        <button className="ek-btn ek-btnGhost ek-btnDanger" type="button" onClick={() => setConfirmOpen(true)} disabled={isBusy || deleting}>
          Delete recipe
        </button>
        <button className="ek-btn ek-btnPrimary" type="button" onClick={save} disabled={isBusy}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this recipe?"
        message={`"${title || "Untitled"}" will be permanently removed. This cannot be undone.`}
        confirmText={deleting ? "Deleting…" : "Yes, delete"}
        cancelText="Cancel"
        onConfirm={doDelete}
        onCancel={() => (deleting ? null : setConfirmOpen(false))}
        zIndex={2400}
      />

      <style jsx>{css}</style>
    </main>
  );
}

const css = `
  .ek-shell {
    max-width: 1140px;
    margin: 0 auto;
    padding: 20px 20px 110px;
    display: grid;
    gap: 16px;
  }
  .ek-topBar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .ek-topTitle {
    flex: 1;
    font-size: 22px;
    font-weight: 900;
    color: var(--text);
    letter-spacing: -.03em;
  }
  .ek-topActions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ek-backBtn {
    display: inline-flex;
    align-items: center;
    height: 40px;
    padding: 0 16px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition: background .15s;
    white-space: nowrap;
  }
  .ek-backBtn:hover { background: color-mix(in oklab, var(--bg2) 70%, var(--primary) 30%); }
  .ek-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 18px;
    border-radius: 12px;
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background .15s, filter .15s, opacity .15s;
    text-decoration: none;
  }
  .ek-btn:disabled { opacity: .5; cursor: not-allowed; }
  .ek-btnPrimary { background: var(--primary); color: var(--primary-contrast); border-color: var(--primary); }
  .ek-btnPrimary:not(:disabled):hover { filter: brightness(1.08); }
  .ek-btnSecondary { background: var(--bg2); color: var(--text); }
  .ek-btnSecondary:not(:disabled):hover { background: color-mix(in oklab, var(--bg2) 70%, var(--primary) 30%); }
  .ek-btnGhost { background: transparent; color: var(--text); }
  .ek-btnGhost:not(:disabled):hover { background: var(--bg2); }
  .ek-btnDanger { color: #ef4444; border-color: color-mix(in oklab, #ef4444 35%, var(--border)); }
  .ek-btnDanger:not(:disabled):hover { background: color-mix(in oklab, #ef4444 10%, var(--bg2)); }
  .ek-uploadLabel { cursor: pointer; }
  .ek-savedBadge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 12px;
    font-weight: 800;
  }
  .ek-err {
    padding: 14px 18px;
    border-radius: 14px;
    background: color-mix(in oklab, #ef4444 10%, var(--bg));
    border: 1px solid color-mix(in oklab, #ef4444 30%, var(--border));
    color: #991b1b;
    font-size: 13px;
    font-weight: 600;
  }
  .ek-layout {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: 16px;
    align-items: start;
  }
  .ek-leftCol, .ek-rightCol { display: grid; gap: 16px; }
  .ek-card {
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 20px;
    background: var(--card-bg, var(--bg2));
    box-shadow: 0 4px 18px rgba(0,0,0,.05);
    display: grid;
    gap: 14px;
  }
  .ek-cardHead { display: grid; gap: 2px; }
  .ek-eye { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--primary); }
  .ek-cardTitle { margin: 0; font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -.02em; }
  .ek-coverWrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .ek-coverImg { width: 100%; height: 100%; object-fit: cover; }
  .ek-coverPh {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
  }
  .ek-coverSub { font-size: 12px; font-weight: 500; }
  .ek-uploadOverlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.45);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    border-radius: 14px;
  }
  .ek-imgActions { display: flex; gap: 10px; flex-wrap: wrap; }
  .ek-hint { font-size: 12px; color: var(--muted); margin: 0; line-height: 1.5; }
  .ek-field { display: grid; gap: 6px; }
  .ek-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ek-lbl { font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .ek-req { color: #ef4444; }
  .ek-inp {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color .15s, box-shadow .15s;
  }
  .ek-inp:focus {
    outline: none;
    border-color: color-mix(in oklab, var(--primary) 60%, var(--border));
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent);
  }
  select.ek-inp { cursor: pointer; }
  .ek-ta { min-height: unset; padding: 10px 12px; resize: vertical; line-height: 1.5; }

  .ek-ingrHeader {
    display: grid;
    grid-template-columns: 22px 1fr 120px 32px;
    gap: 8px;
    padding: 0 0 6px;
    border-bottom: 1px solid var(--border);
  }
  .ek-colLabel { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .ek-ingrList { display: grid; gap: 8px; }
  .ek-ingrRow {
    display: grid;
    grid-template-columns: 22px 1fr 120px 32px;
    gap: 8px;
    align-items: center;
  }
  .ek-rowNum { font-size: 11px; font-weight: 700; color: var(--muted); text-align: right; }
  .ek-removeBtn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background .12s, color .12s, border-color .12s;
    flex-shrink: 0;
  }
  .ek-removeBtn:hover { background: color-mix(in oklab, #ef4444 12%, var(--bg2)); color: #ef4444; border-color: color-mix(in oklab, #ef4444 40%, var(--border)); }
  .ek-addBtn {
    align-self: start;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--primary);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background .12s, border-color .12s;
  }
  .ek-addBtn:hover { background: color-mix(in oklab, var(--primary) 8%, transparent); border-color: var(--primary); }

  .ek-stepList { display: grid; gap: 10px; }
  .ek-stepRow {
    display: grid;
    grid-template-columns: 28px 1fr 32px;
    gap: 10px;
    align-items: start;
  }
  .ek-stepNum {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--primary) 16%, var(--bg2));
    color: var(--primary);
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 8px;
  }

  .ek-bottomBar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    background: color-mix(in oklab, var(--bg) 88%, transparent);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
    z-index: 200;
  }
  .ek-errInline { font-size: 13px; font-weight: 600; color: #ef4444; flex: 1; }

  @media (max-width: 860px) {
    .ek-layout { grid-template-columns: 1fr; }
    .ek-shell { padding: 16px 16px 96px; }
    .ek-row2 { grid-template-columns: 1fr; }
    .ek-bottomBar { padding: 10px 16px; }
    .ek-ingrHeader, .ek-ingrRow { grid-template-columns: 22px 1fr 90px 32px; }
  }
  @media (max-width: 500px) {
    .ek-ingrHeader { display: none; }
    .ek-ingrRow { grid-template-columns: 1fr 80px 32px; }
    .ek-rowNum { display: none; }
    .ek-stepRow { grid-template-columns: 1fr 32px; }
    .ek-stepNum { display: none; }
    .ek-topTitle { display: none; }
  }
`;
