"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import dynamic from "next/dynamic";

const RecipeImageUploader = dynamic(
  () => import("@/components/recipes/RecipeImageUploader"),
  { ssr: false }
);

/* ---------------- types ---------------- */
type IngredientRow = { name: string; qty: string; unit: string };
type RecipeDoc = {
  id: string;
  uid: string;
  title?: string | null;
  image?: string | null;
  imageURL?: string | null;
  category?: string | null;
  area?: string | null;
  ingredients?: { name?: string; measure?: string | null; qty?: string; unit?: string }[];
  instructions?: string | null;
  steps?: string | null;
  author?: { uid?: string | null; name?: string | null; avatarURL?: string | null } | null;
  createdAt?: any;
};

/* ---------------- helpers ---------------- */
function parseMeasure(measure?: string | null): { qty: string; unit: string } {
  if (!measure) return { qty: "", unit: "" };
  // split like "250 g", "1 1/2 cup", "2pcs" → we try a basic split
  const m = String(measure).trim();
  const match = m.match(/^\s*([0-9.\s/]+)\s*([^\s].*)?$/);
  if (!match) return { qty: "", unit: m };
  return {
    qty: (match[1] || "").trim(),
    unit: (match[2] || "").trim(),
  };
}

function packMeasure(row: IngredientRow): string {
  const q = row.qty.trim();
  const u = row.unit.trim();
  return [q, u].filter(Boolean).join(" ").trim();
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [rows, setRows] = useState<IngredientRow[]>([{ name: "", qty: "", unit: "" }]);
  const [instructions, setInstructions] = useState("");
  const [cover, setCover] = useState<string | null>(null);

  const [ownerUid, setOwnerUid] = useState<string | null>(null);

  // auth
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => stop();
  }, []);

  // load recipe
  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const ref = doc(db, "recipes", String(id));
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setErr("Recipe not found.");
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) } as RecipeDoc;

        setOwnerUid(data.uid || null);
        setTitle(data.title || "");
        setCategory(data.category || "");
        setArea(data.area || "");
        setCover(data.image || data.imageURL || null);

        // Ingredients: support either {measure} or {qty, unit}
        const ingRows: IngredientRow[] = Array.isArray(data.ingredients)
          ? data.ingredients.map((i) => {
              const name = i?.name || "";
              const measure = i?.measure ?? [i?.qty, i?.unit].filter(Boolean).join(" ");
              const { qty, unit } = parseMeasure(measure);
              return { name, qty, unit };
            })
          : [{ name: "", qty: "", unit: "" }];
        setRows(ingRows.length ? ingRows : [{ name: "", qty: "", unit: "" }]);

        const steps = data.instructions || data.steps || "";
        setInstructions(steps);

        setErr(null);
      } catch (e: any) {
        setErr(e?.message || "Could not load recipe.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isOwner = useMemo(() => !!me && !!ownerUid && me.uid === ownerUid, [me, ownerUid]);

  function setRow(i: number, patch: Partial<IngredientRow>) {
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((l) => [...l, { name: "", qty: "", unit: "" }]);
  }
  function removeRow(i: number) {
    setRows((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l));
  }

  async function save() {
    if (!id) return;
    if (!isOwner) {
      setErr("You can only edit your own recipe.");
      return;
    }
    if (!title.trim()) {
      setErr("Please enter a title.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const ref = doc(db, "recipes", String(id));
      const ingredients = rows
        .map((r) => ({
          name: r.name.trim(),
          measure: packMeasure(r),
        }))
        .filter((x) => x.name);

      await updateDoc(ref, {
        title: title.trim(),
        titleLower: title.trim().toLowerCase(),
        category: category.trim() || null,
        area: area.trim() || null,
        ingredients,
        instructions: instructions.trim() || null,
        updatedAt: serverTimestamp(),
      });

      // done
      router.push(`/recipes/${id}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !isOwner) return;
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "recipes", String(id)));
      router.push("/recipes");
    } catch (e: any) {
      setErr(e?.message || "Failed to delete.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">Loading…</div>
        <style jsx>{styles}</style>
      </main>
    );
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
      {/* Sticky top action bar */}
      <div className="stickyBar">
        <div className="left">
          <h1 className="pageTitle">Edit recipe</h1>
          <span className="subtle">Make changes and save</span>
        </div>
        <div className="right">
          <Link className="btn ghost" href={`/recipes/${id}`}>Cancel</Link>
          <button className="btn danger" onClick={remove} disabled={saving}>Delete</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid">
        <section className="pane">
          <h3 className="h3">Basics</h3>
          <div className="field">
            <label className="label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="Best Tomato Pasta"
            />
          </div>
          <div className="row2">
            <div className="field">
              <label className="label">Category (optional)</label>
              <input
                className="input"
                value={category}
                onChange={(e) => setCategory(e.currentTarget.value)}
                placeholder="Pasta"
              />
            </div>
            <div className="field">
              <label className="label">Area (optional)</label>
              <input
                className="input"
                value={area}
                onChange={(e) => setArea(e.currentTarget.value)}
                placeholder="Italian"
              />
            </div>
          </div>
        </section>

        <section className="pane">
          <h3 className="h3">Cover</h3>
          <div className="muted small" style={{ marginBottom: 8 }}>
            Tip: big, wide images look best.
          </div>
          {/* Use your existing uploader; it writes back via onCoverSaved */}
          {me?.uid ? (
            <RecipeImageUploader
              uid={me.uid}
              recipeId={String(id)}
              initialCoverUrl={cover ?? undefined}
              onCoverSaved={async (url) => {
                setCover(url);
                try {
                  await updateDoc(doc(db, "recipes", String(id)), { image: url });
                } catch {}
              }}
            />
          ) : null}
        </section>

        <section className="pane">
          <h3 className="h3">Ingredients</h3>

          <div className="rows">
            {rows.map((r, i) => (
              <div key={i} className="ingRow">
                <input
                  className="ing name"
                  placeholder="Ingredient (e.g. Tomato)"
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.currentTarget.value })}
                />
                <input
                  className="ing qty"
                  placeholder="Qty"
                  value={r.qty}
                  onChange={(e) => setRow(i, { qty: e.currentTarget.value })}
                />
                <input
                  className="ing unit"
                  placeholder="Unit (g, ml, cup, pcs…)"
                  value={r.unit}
                  onChange={(e) => setRow(i, { unit: e.currentTarget.value })}
                />
                <button className="minus" onClick={() => removeRow(i)} aria-label="Remove">
                  −
                </button>
              </div>
            ))}
          </div>
          <div className="footerRow">
            <button className="btn" onClick={addRow} type="button">
              Add ingredient
            </button>
          </div>
        </section>

        <section className="pane">
          <h3 className="h3">Instructions</h3>
          <textarea
            className="ta"
            rows={10}
            value={instructions}
            onChange={(e) => setInstructions(e.currentTarget.value)}
            placeholder={`1) Boil salted water.\n2) Cook pasta until al dente.\n3) Toss with sauce…`}
          />
        </section>
      </div>

      {err && <p className="errorCard">{err}</p>}

      <style jsx>{styles}</style>
    </main>
  );
}

/* ---------------- styles (modern, sticky header, glassy panes) ---------------- */
const styles = `
:root{
  --border: #e5e7eb;
  --bg: #f8fafc;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --primary: #0f172a;
  --primary-contrast: #ffffff;
}

*{box-sizing:border-box}
.wrap{max-width:1100px;margin:0 auto;padding:18px}

.stickyBar{
  position:sticky; top:8px; z-index:10;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  background: color-mix(in oklab, var(--card) 80%, transparent);
  border:1px solid var(--border); border-radius:14px; padding:10px 12px;
  backdrop-filter: blur(6px);
  box-shadow:0 10px 30px rgba(2,6,23,.06);
}
.pageTitle{margin:0; font-size:18px; font-weight:900; letter-spacing:-.01em; color:var(--text)}
.subtle{color:var(--muted); font-size:12px; margin-left:8px}
.right{display:flex; gap:8px; align-items:center}
.btn{
  border:1px solid var(--border); background:var(--card);
  color:var(--text); border-radius:10px; padding:8px 12px; font-weight:800; cursor:pointer;
}
.btn:hover{ background:#f3f4f6 }
.btn.primary{ background:var(--primary); color:var(--primary-contrast); border-color:var(--primary) }
.btn.primary:hover{ filter:brightness(1.05) }
.btn.ghost{ background:transparent }
.btn.danger{ background:#fee2e2; border-color:#fecaca; color:#7f1d1d }
.btn.danger:hover{ background:#fecaca }

.grid{
  margin-top:14px;
  display:grid; grid-template-columns: 1.2fr .8fr; gap:14px;
}
@media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }

.pane{
  border:1px solid var(--border);
  background: linear-gradient(180deg, color-mix(in oklab, var(--card) 92%, transparent), var(--card));
  border-radius:16px; padding:14px;
  box-shadow:0 10px 30px rgba(0,0,0,.04);
}
.h3{margin:0 0 10px; font-size:16px; font-weight:900; letter-spacing:-.01em; color:var(--text)}
.field{display:grid; gap:6px; margin-bottom:10px}
.label{font-size:.84rem; color:var(--muted); font-weight:800}
.input{
  width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px;
  background:#fff; color:var(--text); outline:none;
}
.input:focus{ border-color: color-mix(in oklab, var(--primary) 60%, var(--border)); box-shadow:0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent)}
.row2{display:grid; grid-template-columns: 1fr 1fr; gap:12px}
@media (max-width: 720px){ .row2{ grid-template-columns:1fr } }

.rows{display:grid; gap:8px}
.ingRow{display:grid; grid-template-columns: 1.5fr .5fr .6fr 36px; gap:8px; align-items:center}
.ing{
  border:1px solid var(--border); border-radius:10px; padding:9px 10px; background:#fff; color:var(--text);
}
.minus{border:0; background:#ef4444; color:#fff; border-radius:10px; font-weight:800; cursor:pointer}
.footerRow{display:flex; justify-content:flex-end; margin-top:6px}

.ta{
  width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background:#fff; color:var(--text);
  min-height:220px; resize:vertical; line-height:1.5;
}

.card{ border:1px solid var(--border); background:var(--card); border-radius:16px; padding:16px }
.errorCard{ margin-top:12px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:10px; padding:10px 12px; }

.btn:disabled{opacity:.7; cursor:not-allowed}
`;
