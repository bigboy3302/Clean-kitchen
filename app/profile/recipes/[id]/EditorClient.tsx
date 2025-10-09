"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";
import BookWritingLoader from "./BookWritingLoader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/* ---------------- types ---------------- */
type Row = { name: string; qty: string; unit: "g" | "kg" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup" };
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
};

/* ---------------- helpers ---------------- */
function parseMeasure(measure?: string | null): { qty: string; unit: Row["unit"] | "" } {
  if (!measure) return { qty: "", unit: "" };
  const m = String(measure).trim();
  const match = m.match(/^\s*([0-9.\s/]+)\s*(.*)$/);
  const qty = (match?.[1] || "").trim();
  const unitGuess = (match?.[2] || "").trim().toLowerCase();
  const unitMap = new Set(["g", "kg", "ml", "l", "pcs", "tbsp", "tsp", "cup"]);
  const unit = (unitMap.has(unitGuess) ? (unitGuess as Row["unit"]) : "") || "";
  return { qty, unit };
}
function packMeasure(r: Row): string {
  const q = r.qty.trim();
  const u = r.unit?.trim();
  return [q, u].filter(Boolean).join(" ").trim();
}
function toStepsArray(instructions?: string | null): string[] {
  if (!instructions) return [""];
  return String(instructions)
    .split("\n")
    .map((s) => s.replace(/^\s*\d+\)\s*/, "").trim())
    .filter((s, i) => s.length || i === 0)
    .slice(0, 200);
}
function toInstructionsText(steps: string[]): string {
  return steps
    .map((s, i) => (s.trim() ? `${i + 1}) ${s.trim()}` : ""))
    .filter(Boolean)
    .join("\n");
}

/* =========================================================================
   CLIENT EDITOR — waits for auth before permission logic (no flash)
   ========================================================================= */
export default function EditorClient({ initial }: { initial: RecipeDoc }) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  // Auth
  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setMe(u || null);
      setAuthReady(true);
    });
    return () => stop();
  }, []);

  // Seed UI state from server data
  const [ownerUid] = useState<string | null>(initial?.uid || null);
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [area, setArea] = useState(initial?.area || "");
  const [cover, setCover] = useState<string | null>(initial?.image || initial?.imageURL || null);

  const rowsSeed: Row[] =
    Array.isArray(initial?.ingredients) && initial.ingredients.length
      ? initial.ingredients.map((i) => {
          const name = i?.name?.trim() || "";
          const { qty, unit } = parseMeasure(i?.measure);
          return { name, qty, unit: (unit as Row["unit"]) || "g" };
        })
      : [{ name: "", qty: "", unit: "g" }];
  const [rows, setRows] = useState<Row[]>(rowsSeed);
  const [steps, setSteps] = useState<string[]>(toStepsArray(initial?.instructions));

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Delete confirm UX
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const isOwner = useMemo(() => !!me && !!ownerUid && me.uid === ownerUid, [me, ownerUid]);

  /* ---------- ingredient rows ---------- */
  function setRow(i: number, patch: Partial<Row>) {
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((l) => [...l, { name: "", qty: "", unit: "g" }]); }
  function removeRow(i: number) { setRows((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l)); }

  /* ---------- steps ---------- */
  function setStepText(i: number, val: string) { setSteps((s) => s.map((t, idx) => (idx === i ? val : t))); }
  function addStep() { setSteps((s) => [...s, ""]); }
  function removeStep(i: number) { setSteps((s) => (s.length > 1 ? s.filter((_, idx) => idx !== i) : s)); }

  /* ---------- cover upload (fix pooled event with a ref) ---------- */
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = fileInputRef.current;            // safe reference
    const file = e.currentTarget.files?.[0];         // read immediately
    if (!file || !me?.uid || !id) {
      if (inputEl) inputEl.value = "";
      return;
    }
    setSaving(true);
    try {
      const path = `recipeImages/${me.uid}/${id}/cover`;
      const storageRef = sref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "recipes", String(id)), { image: url, updatedAt: serverTimestamp() });
      setCover(url);
    } catch (e: any) {
      setErr(e?.message || "Failed to upload cover.");
    } finally {
      setSaving(false);
      if (inputEl) inputEl.value = "";              // reset selection reliably
    }
  }

  async function onRemoveCover() {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "recipes", String(id)), { image: null, updatedAt: serverTimestamp() });
      setCover(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to remove cover.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- save / delete ---------- */
  async function save() {
    if (!id) return;
    if (!isOwner) { setErr("You can only edit your own recipe."); return; }
    if (!title.trim()) { setErr("Please enter a title."); return; }

    setSaving(true);
    setErr(null);
    try {
      const ingredients = rows
        .map((r) => ({ name: r.name.trim(), measure: packMeasure(r) }))
        .filter((x) => x.name);

      await updateDoc(doc(db, "recipes", String(id)), {
        title: title.trim(),
        titleLower: title.trim().toLowerCase(),
        category: category.trim() || null,
        area: area.trim() || null,
        ingredients,
        instructions: toInstructionsText(steps),
        updatedAt: serverTimestamp(),
      });

      router.push("/recipes");
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!id || !isOwner) return;
    setDeleteErr(null);
    setConfirmOpen(true);
  }

  async function doDelete() {
    if (!id || !isOwner || deleting) return;
    setDeleteErr(null);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "recipes", String(id)));
      setConfirmOpen(false);
      router.push("/recipes");
    } catch (e: any) {
      setDeleteErr(e?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  }

  /* ---------- render ---------- */
  if (!authReady) {
    return <BookWritingLoader variant="flip" />;
  }

  if (!isOwner) {
    return (
      <main className="wrap">
        <div className="card error">
          You don’t have permission to edit this recipe.
          <div style={{ marginTop: 10 }}>
            <Link className="btn" href={`/recipes/${id}`}>View recipe</Link>
          </div>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="wrap">
      {/* Sticky bar */}
      <div className="stickyBar">
        <div className="left">
          <h1 className="pageTitle">Edit recipe</h1>
          <span className="subtle">Update details and save</span>
        </div>
        <div className="right">
          <Link className="btn ghost" href={`/recipes`}>Cancel</Link>
          <button className="btn danger" onClick={remove} disabled={saving || deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Cover */}
      <section className="heroCard">
        <div className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover || "/placeholder.png"} alt={title || "cover"} className="heroImg" />
          <div className="heroGrad" />
          <div className="heroText">
            <input className="titleInput" value={title} onChange={(e)=>setTitle(e.currentTarget.value)} placeholder="Recipe title" />
            <div className="chipRow">
              <input className="chipInput" value={category} onChange={(e)=>setCategory(e.currentTarget.value)} placeholder="Category" />
              <input className="chipInput" value={area} onChange={(e)=>setArea(e.currentTarget.value)} placeholder="Area" />
            </div>
          </div>
          <div className="heroActions">
            <label className="btn sm primary">
              Change cover
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPickCover}
                hidden
              />
            </label>
            {cover ? <button className="btn sm ghost" onClick={onRemoveCover} disabled={saving}>Remove</button> : null}
          </div>
        </div>
      </section>

      {/* Form */}
      <div className="grid">
        <section className="pane">
          <h3 className="h3">Ingredients</h3>
          <div className="rows">
            {rows.map((r, i) => (
              <div key={i} className="rowIng">
                <input className="name" placeholder="Ingredient" value={r.name} onChange={(e)=>setRow(i, { name: e.currentTarget.value })} />
                <input className="qty" type="number" min={0} placeholder="Qty" value={r.qty} onChange={(e)=>setRow(i, { qty: e.currentTarget.value })} />
                <select className="unit" value={r.unit} onChange={(e)=>setRow(i, { unit: e.currentTarget.value as Row["unit"] })}>
                  <option value="g">g</option><option value="kg">kg</option>
                  <option value="ml">ml</option><option value="l">l</option>
                  <option value="pcs">pcs</option><option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option><option value="cup">cup</option>
                </select>
                <button className="minus" onClick={()=>removeRow(i)} aria-label="Remove">−</button>
              </div>
            ))}
          </div>
          <div className="footerRow">
            <button className="btn" onClick={addRow} type="button">Add ingredient</button>
          </div>
        </section>

        <section className="pane">
          <h3 className="h3">Instructions</h3>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={i} className="stepRow">
                <div className="num">({i+1})</div>
                <input className="stepInput" placeholder="Write step…" value={s} onChange={(e)=>setStepText(i, e.currentTarget.value)} />
                <button className="minus" onClick={()=>removeStep(i)} aria-label="Remove">−</button>
              </div>
            ))}
          </div>
          <div className="footerRow">
            <button className="btn" onClick={addStep} type="button">Add step</button>
          </div>
        </section>
      </div>

      {err && <p className="errorCard">{err}</p>}
      {deleteErr && <p className="errorCard">{deleteErr}</p>}

      {/* Confirm deletion popup */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this recipe?"
        message={`“${title || "Untitled"}” will be permanently removed.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        onConfirm={doDelete}
        onCancel={() => (deleting ? null : setConfirmOpen(false))}
        zIndex={2400}
      />

      <style jsx>{styles}</style>
    </main>
  );
}

/* ---------------- styles ---------------- */
const styles = `
:root{--border:#e5e7eb;--bg:#f8fafc;--card:#fff;--text:#0f172a;--muted:#64748b;--primary:#0f172a;--primary-contrast:#fff}
*{box-sizing:border-box}.wrap{max-width:1100px;margin:0 auto;padding:18px}
.stickyBar{position:sticky;top:8px;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;background:color-mix(in oklab,var(--card) 80%,transparent);border:1px solid var(--border);border-radius:14px;padding:10px 12px;backdrop-filter:blur(6px);box-shadow:0 10px 30px rgba(2,6,23,.06)}
.pageTitle{margin:0;font-size:18px;font-weight:900;letter-spacing:-.01em;color:var(--text)}.subtle{color:var(--muted);font-size:12px;margin-left:8px}
.right{display:flex;gap:8px;align-items:center}
.btn{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}
.btn:hover{background:#f3f4f6}.btn.primary{background:var(--primary);color:var(--primary-contrast);border-color:var(--primary)}.btn.primary:hover{filter:brightness(1.05)}
.btn.ghost{background:transparent}.btn.danger{background:#fee2e2;border-color:#fecaca;color:#7f1d1d}.btn.danger:hover{background:#fecaca}.btn.sm{padding:6px 10px;font-size:13px}
.heroCard{margin-top:14px}.hero{position:relative;border:1px solid var(--border);border-radius:16px;overflow:hidden;height:320px;box-shadow:0 20px 50px rgba(2,6,23,.06)}
.heroImg{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1);transition:transform .7s ease}.hero:hover .heroImg{transform:scale(1.04)}
.heroGrad{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.55) 70%)}
.heroText{position:absolute;left:14px;right:14px;bottom:14px;z-index:2;display:grid;gap:8px}
.titleInput{border:0;border-radius:12px;padding:10px 12px;font-weight:900;font-size:20px;background:rgba(255,255,255,.14);color:#fff;outline:none;backdrop-filter:blur(4px)}.titleInput::placeholder{color:rgba(255,255,255,.9)}
.chipRow{display:flex;gap:8px;flex-wrap:wrap}.chipInput{border:0;border-radius:999px;padding:6px 10px;font-weight:700;font-size:12px;background:rgba(255,255,255,.18);color:#fff;outline:none;backdrop-filter:blur(4px)}
.heroActions{position:absolute;right:12px;top:12px;display:flex;gap:8px;z-index:2}
.grid{margin-top:14px;display:grid;grid-template-columns:1.2fr .8fr;gap:14px}@media (max-width:980px){.grid{grid-template-columns:1fr}}
.pane{border:1px solid var(--border);background:linear-gradient(180deg,color-mix(in oklab,var(--card) 92%,transparent),var(--card));border-radius:16px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.04)}
.h3{margin:0 0 10px;font-size:16px;font-weight:900;letter-spacing:-.01em;color:var(--text)}
.rows{display:grid;gap:8px}.rowIng{display:grid;grid-template-columns:1fr 100px 110px 34px;gap:8px}
.name,.qty,.unit{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:#fff;color:#0f172a}
.minus{border:0;background:#ef4444;color:#fff;border-radius:10px;cursor:pointer;font-weight:800}
.footerRow{display:flex;justify-content:flex-end;margin-top:8px}
.steps{display:grid;gap:8px}.stepRow{display:grid;grid-template-columns:44px 1fr 34px;gap:8px;align-items:center}
.num{font-weight:800;text-align:center}.stepInput{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:#fff;color:#0f172a}
.card{border:1px solid var(--border);background:var(--card);border-radius:16px;padding:16px}
.errorCard{margin-top:12px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:10px;padding:10px 12px}
`;
