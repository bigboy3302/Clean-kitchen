"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { db } from "@/lib/firebas1e";
import { doc, onSnapshot, updateDoc, deleteDoc, type FirestoreError } from "firebase/firestore";

type Ingredient = { name: string; amount: string };

type RecipeDoc = {
  id: string;
  uid?: string;
  title?: string | null;
  description?: string | null;
  imageURL?: string | null;
  image?: string | null;
  timeMinutes?: number | null;
  servings?: number | null;
  category?: string | null;
  area?: string | null;
  ingredients?: Array<{ name?: string; measure?: string | null; qty?: string; unit?: string }>;
  instructions?: string | null;
  steps?: string | null;
};

function toRows(list?: RecipeDoc["ingredients"]): Ingredient[] {
  if (!Array.isArray(list) || list.length === 0) return [{ name: "", amount: "" }];
  const rows = list
    .map((it) => ({
      name: (it?.name ?? "").trim(),
      amount:
        (it?.measure ?? "").trim() ||
        [it?.qty, it?.unit].filter(Boolean).join(" ").trim(),
    }))
    .filter((r) => r.name);
  return rows.length ? rows : [{ name: "", amount: "" }];
}

function fromRows(rows: Ingredient[]) {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({ name: r.name.trim(), measure: r.amount.trim() || null }));
}

function parseSteps(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const CATEGORIES = [
  "Beef","Breakfast","Chicken","Dessert","Goat","Lamb","Miscellaneous","Pasta",
  "Pork","Seafood","Side","Starter","Vegan","Vegetarian",
];

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);

  // form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "" }]);
  const [steps, setSteps] = useState<string[]>([""]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "recipes", String(id));
    const stop = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setRecipe(null);
          setLoadErr("Recipe not found or was deleted.");
          return;
        }
        const data = snap.data() as Omit<RecipeDoc, "id">;
        const next: RecipeDoc = { id: snap.id, ...data };
        setRecipe(next);
        setLoadErr(null);
        setTitle(next.title ?? "");
        setDescription(next.description ?? "");
        setTimeMinutes(next.timeMinutes != null ? String(next.timeMinutes) : "");
        setServings(next.servings != null ? String(next.servings) : "");
        setCategory(next.category ?? "");
        setArea(next.area ?? "");
        setImageURL((next.imageURL ?? next.image ?? "") || "");
        setIngredients(toRows(next.ingredients));
        const rawSteps = (next.instructions ?? next.steps ?? "").trim();
        setSteps(rawSteps ? parseSteps(rawSteps) : [""]);
      },
      (e: FirestoreError) => {
        setLoading(false);
        setLoadErr(e.message || "Could not load recipe.");
      }
    );
    return () => stop();
  }, [id]);

  /* ── ingredient helpers ── */
  function updateIngredient(i: number, field: keyof Ingredient, val: string) {
    setIngredients((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  }
  function addIngredient() {
    setIngredients((prev) => [...prev, { name: "", amount: "" }]);
  }
  function removeIngredient(i: number) {
    setIngredients((prev) => (prev.length === 1 ? [{ name: "", amount: "" }] : prev.filter((_, idx) => idx !== i)));
  }

  /* ── step helpers ── */
  function updateStep(i: number, val: string) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, ""]);
  }
  function removeStep(i: number) {
    setSteps((prev) => (prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i)));
  }

  const validate = () => {
    if (!title.trim()) return "Recipe title is required.";
    const t = Number(timeMinutes);
    if (!timeMinutes || isNaN(t) || t <= 0) return "Cooking time must be a positive number.";
    const s = Number(servings);
    if (!servings || isNaN(s) || s <= 0) return "Servings must be a positive number.";
    return null;
  };

  const onSave = async () => {
    const msg = validate();
    if (msg) { setErr(msg); return; }
    setBusy(true);
    setErr(null);
    try {
      await updateDoc(doc(db, "recipes", String(id)), {
        title: title.trim(),
        description: description.trim() || null,
        timeMinutes: Number(timeMinutes),
        servings: Number(servings),
        category: category.trim() || null,
        area: area.trim() || null,
        imageURL: imageURL.trim() || null,
        ingredients: fromRows(ingredients),
        instructions: steps.filter(Boolean).join("\n") || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this recipe permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "recipes", String(id)));
      router.push("/recipes");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete recipe.");
      setBusy(false);
    }
  };

  /* ── loading / error states ── */
  if (loading) return (
    <main className="shell">
      <div className="loadBox">Loading recipe…</div>
      <style jsx>{sharedCss}</style>
    </main>
  );
  if (loadErr || !recipe) return (
    <main className="shell">
      <div className="errBox">{loadErr || "Recipe not found."}</div>
      <Link href="/recipes" className="backBtn">← Back to recipes</Link>
      <style jsx>{sharedCss}</style>
    </main>
  );

  const cover = imageURL.trim() || null;

  return (
    <main className="shell">
      {/* top bar */}
      <div className="topBar">
        <Link href={`/recipes/${id}`} className="backBtn">← Back to recipe</Link>
        <div className="topActions">
          {saved && <span className="savedBadge">✓ Saved</span>}
          <button className="btn btnPrimary" onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button className="btn btnGhost btnDanger" onClick={onDelete} disabled={busy}>
            Delete recipe
          </button>
        </div>
      </div>

      {err && <div className="errBox">{err}</div>}

      <div className="layout">
        {/* left column */}
        <div className="leftCol">

          {/* image preview */}
          <div className="card">
            <div className="cardHead">
              <span className="cardEye">Cover image</span>
              <h2 className="cardTitle">Photo</h2>
            </div>
            <div className="coverWrap">
              {cover ? (
                <Image src={cover} alt={title || "Recipe"} fill className="coverImg" sizes="(min-width:900px) 360px,100vw" />
              ) : (
                <div className="coverPh">No image yet</div>
              )}
            </div>
            <div className="fieldGroup">
              <label className="lbl">Image URL</label>
              <input
                ref={imgInputRef}
                className="inp"
                value={imageURL}
                onChange={(e) => setImageURL(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
              <p className="hint">Paste a public image URL — it will preview above.</p>
            </div>
          </div>

          {/* basic info */}
          <div className="card">
            <div className="cardHead">
              <span className="cardEye">Required</span>
              <h2 className="cardTitle">Basic info</h2>
            </div>

            <div className="fieldGroup">
              <label className="lbl">Recipe title <span className="req">*</span></label>
              <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chicken Alfredo" />
            </div>

            <div className="fieldGroup">
              <label className="lbl">Description</label>
              <textarea className="inp inp--ta" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description shown in the recipe card…" />
            </div>

            <div className="row2">
              <div className="fieldGroup">
                <label className="lbl">Cook time (minutes) <span className="req">*</span></label>
                <input className="inp" type="number" min={1} value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} placeholder="30" />
              </div>
              <div className="fieldGroup">
                <label className="lbl">Servings <span className="req">*</span></label>
                <input className="inp" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
              </div>
            </div>

            <div className="row2">
              <div className="fieldGroup">
                <label className="lbl">Category</label>
                <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">— pick one —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value={category && !CATEGORIES.includes(category) ? category : "__other__"}>Other</option>
                </select>
                {category && !CATEGORIES.includes(category) && (
                  <input className="inp" style={{ marginTop: 6 }} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Custom category" />
                )}
              </div>
              <div className="fieldGroup">
                <label className="lbl">Cuisine / area</label>
                <input className="inp" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Italian, Mexican…" />
              </div>
            </div>
          </div>
        </div>

        {/* right column */}
        <div className="rightCol">

          {/* ingredients */}
          <div className="card">
            <div className="cardHead">
              <span className="cardEye">What you need</span>
              <h2 className="cardTitle">Ingredients</h2>
            </div>
            <p className="hint" style={{ marginBottom: 12 }}>Add each ingredient with an optional amount (e.g. &quot;200g&quot; or &quot;2 cups&quot;).</p>

            <div className="ingrList">
              {ingredients.map((row, i) => (
                <div key={i} className="ingrRow">
                  <span className="ingrNum">{i + 1}</span>
                  <input
                    className="inp ingrName"
                    value={row.name}
                    onChange={(e) => updateIngredient(i, "name", e.target.value)}
                    placeholder="Ingredient name"
                  />
                  <input
                    className="inp ingrAmt"
                    value={row.amount}
                    onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                    placeholder="Amount"
                  />
                  <button type="button" className="removeBtn" onClick={() => removeIngredient(i)} title="Remove">×</button>
                </div>
              ))}
            </div>
            <button type="button" className="addRowBtn" onClick={addIngredient}>+ Add ingredient</button>
          </div>

          {/* steps */}
          <div className="card">
            <div className="cardHead">
              <span className="cardEye">How to make it</span>
              <h2 className="cardTitle">Instructions</h2>
            </div>
            <p className="hint" style={{ marginBottom: 12 }}>Write each step of the recipe. They will be numbered automatically.</p>

            <div className="stepList">
              {steps.map((step, i) => (
                <div key={i} className="stepRow">
                  <div className="stepNum">{i + 1}</div>
                  <textarea
                    className="inp inp--ta stepTa"
                    rows={2}
                    value={step}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder={`Step ${i + 1}…`}
                  />
                  <button type="button" className="removeBtn" onClick={() => removeStep(i)} title="Remove">×</button>
                </div>
              ))}
            </div>
            <button type="button" className="addRowBtn" onClick={addStep}>+ Add step</button>
          </div>
        </div>
      </div>

      {/* bottom save bar */}
      <div className="bottomBar">
        {err && <span className="errInline">{err}</span>}
        {saved && <span className="savedBadge">✓ Saved</span>}
        <div style={{ flex: 1 }} />
        <button className="btn btnGhost btnDanger" onClick={onDelete} disabled={busy}>Delete recipe</button>
        <button className="btn btnPrimary" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>

      <style jsx>{sharedCss}</style>
    </main>
  );
}

const sharedCss = `
  .shell {
    max-width: 1120px;
    margin: 0 auto;
    padding: 20px 20px 120px;
    display: grid;
    gap: 16px;
  }
  .loadBox, .errBox {
    padding: 20px 24px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--muted);
    font-size: 14px;
  }
  .errBox {
    background: color-mix(in oklab, #ef4444 12%, var(--bg));
    border-color: color-mix(in oklab, #ef4444 35%, var(--border));
    color: #7f1d1d;
  }
  .topBar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .topActions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .backBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 16px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition: background 0.15s;
  }
  .backBtn:hover { background: color-mix(in oklab, var(--bg2) 70%, var(--primary) 30%); }
  .btn {
    height: 40px;
    padding: 0 18px;
    border-radius: 12px;
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, opacity 0.15s;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btnPrimary { background: var(--primary); color: var(--primary-contrast); border-color: var(--primary); }
  .btnPrimary:not(:disabled):hover { filter: brightness(1.08); }
  .btnGhost { background: var(--bg2); color: var(--text); }
  .btnGhost:not(:disabled):hover { background: color-mix(in oklab, var(--bg2) 70%, var(--primary) 30%); }
  .btnDanger { color: #ef4444; border-color: color-mix(in oklab, #ef4444 40%, var(--border)); }
  .btnDanger:not(:disabled):hover { background: color-mix(in oklab, #ef4444 12%, var(--bg2)); }
  .savedBadge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 12px;
    font-weight: 800;
  }
  .layout {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 16px;
    align-items: start;
  }
  .leftCol, .rightCol {
    display: grid;
    gap: 16px;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 20px;
    background: var(--card-bg, var(--bg2));
    box-shadow: 0 4px 18px rgba(0,0,0,.05);
    display: grid;
    gap: 14px;
  }
  .cardHead { display: grid; gap: 2px; }
  .cardEye {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--primary);
  }
  .cardTitle { margin: 0; font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -.02em; }
  .coverWrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .coverImg { object-fit: cover; }
  .coverPh {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
  .fieldGroup { display: grid; gap: 6px; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .lbl { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .req { color: #ef4444; }
  .hint { font-size: 12px; color: var(--muted); margin: 0; }
  .inp {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .inp:focus { outline: none; border-color: color-mix(in oklab, var(--primary) 60%, var(--border)); box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent); }
  .inp--ta { min-height: unset; padding: 10px 12px; resize: vertical; font-family: inherit; line-height: 1.5; }
  select.inp { cursor: pointer; }

  .ingrList { display: grid; gap: 8px; }
  .ingrRow {
    display: grid;
    grid-template-columns: 22px 1fr 100px 32px;
    gap: 8px;
    align-items: center;
  }
  .ingrNum { font-size: 12px; font-weight: 700; color: var(--muted); text-align: right; }
  .ingrName { }
  .ingrAmt { }
  .removeBtn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
    padding: 0;
  }
  .removeBtn:hover { background: color-mix(in oklab, #ef4444 14%, var(--bg2)); color: #ef4444; border-color: color-mix(in oklab, #ef4444 40%, var(--border)); }
  .addRowBtn {
    align-self: start;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--primary);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .addRowBtn:hover { background: color-mix(in oklab, var(--primary) 8%, transparent); border-color: var(--primary); }

  .stepList { display: grid; gap: 10px; }
  .stepRow {
    display: grid;
    grid-template-columns: 28px 1fr 32px;
    gap: 10px;
    align-items: start;
  }
  .stepNum {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--primary) 18%, var(--bg2));
    color: var(--primary);
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 8px;
  }
  .stepTa { width: 100%; }

  .bottomBar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    background: color-mix(in oklab, var(--bg) 90%, transparent);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
    z-index: 100;
  }
  .errInline { font-size: 13px; font-weight: 600; color: #ef4444; }

  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; }
    .shell { padding: 16px 16px 100px; }
    .row2 { grid-template-columns: 1fr; }
    .bottomBar { padding: 10px 16px; }
    .ingrRow { grid-template-columns: 22px 1fr 80px 32px; }
  }
  @media (max-width: 500px) {
    .ingrRow { grid-template-columns: 1fr 80px 32px; }
    .ingrNum { display: none; }
    .stepRow { grid-template-columns: 1fr 32px; }
    .stepNum { display: none; }
  }
`;
