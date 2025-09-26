"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "@/lib/firebase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { CommonRecipe, Ingredient } from "@/components/recipes/types";
import RecipeModal from "@/components/recipes/RecipeModal";
import RecipeCard, { IngredientObj } from "@/components/recipes/RecipeCard";
import {
  getRandomMeals, searchMealsByIngredient, searchMealsByName,
  lookupMealById, searchMealsByIngredientsAND,
} from "@/lib/recipesApi";

/* ---------------- helpers ---------------- */
const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());
const ridFor = (r: CommonRecipe) => (r.source === "api" ? `api-${r.id}` : `user-${r.id}`);

/* =========================================================================
   PANTRY PICKER (popup)
   ========================================================================= */
function PantryPicker({
  open, onClose, allItems, onSearch, busy,
}: {
  open: boolean; onClose: () => void; allItems: string[]; onSearch: (terms: string[]) => void; busy?: boolean;
}) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (open) setSel([]); }, [open]);
  function toggle(n: string) { setSel((xs) => xs.includes(n) ? xs.filter(v => v!==n) : [...xs, n]); }
  if (!open) return null;
  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="bh">
          <div className="bt">Find recipes with my pantry</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {allItems.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>Your pantry is empty.</p>
        ) : (
          <>
            <div className="chips">
              {allItems.map((n) => (
                <label key={n} className={`chip ${sel.includes(n) ? "on" : ""}`}>
                  <input type="checkbox" checked={sel.includes(n)} onChange={() => toggle(n)} />
                  <span>{n}</span>
                </label>
              ))}
            </div>
            <div className="row">
              <Button onClick={() => onSearch(sel)} disabled={!sel.length || !!busy}>
                {busy ? "Searching…" : `Search (${sel.length})`}
              </Button>
              <Button variant="secondary" onClick={onClose} disabled={!!busy}>Cancel</Button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:1400}
        .box{width:100%;max-width:760px;max-height:90vh;overflow:auto;background:var(--card-bg);border-radius:16px;border:1px solid var(--border)}
        .bh{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:10px 12px}
        .bt{font-weight:800;color:var(--text)}
        .x{border:none;background:var(--text);color:var(--primary-contrast);border-radius:10px;padding:4px 10px;cursor:pointer}
        .chips{display:flex;flex-wrap:wrap;gap:10px;padding:12px}
        .chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:6px 10px;background:var(--bg2);cursor:pointer;user-select:none}
        .chip input{display:none}
        .chip.on{background:#e0f2fe;border-color:#7dd3fc}
        .row{display:flex;gap:8px;justify-content:flex-end;padding:0 12px 12px}
      `}</style>
    </div>
  );
}

/* =========================================================================
   CREATE RECIPE WIZARD (structured ingredients + auto-numbered steps)
   ========================================================================= */
type Row = { name: string; qty: string; unit: "g" | "kg" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup" };

function CreateRecipeWizard({
  open, onClose, onSaved, meUid,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; meUid: string | null;
}) {
  const [step, setStep] = useState<0|1|2|3>(0);

  // step 0
  const [title, setTitle] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPrev, setImgPrev] = useState<string | null>(null);

  // step 1: ingredients as structured rows
  const [rows, setRows] = useState<Row[]>([{ name:"", qty:"", unit:"g" }]);

  // step 2: steps with auto numbers
  const [steps, setSteps] = useState<string[]>(["", "", ""]); // 3 by default

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setTitle(""); setImgFile(null); setImgPrev(null);
    setRows([{name:"",qty:"",unit:"g"}]); setSteps(["","",""]);
    setErr(null);
  }, [open]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((list) => list.map((r,idx)=> idx===i ? {...r, ...patch} : r));
  }
  function addRow() { setRows((l)=>[...l, {name:"",qty:"",unit:"g"}]); }
  function removeRow(i:number){ setRows((l)=> l.length>1 ? l.filter((_,idx)=>idx!==i) : l); }

  function setStepText(i:number, val:string){ setSteps((s)=> s.map((t,idx)=> idx===i ? val : t)); }
  function addStep(){ setSteps((s)=> [...s, ""]); }
  function removeStep(i:number){ setSteps((s)=> s.length>1 ? s.filter((_,idx)=>idx!==i) : s); }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0] || null;
    if (!f) return;
    setImgFile(f); setImgPrev(URL.createObjectURL(f));
  }

  async function save() {
    if (!meUid) return alert("Please sign in.");
    const t = capFirst(title.trim());
    const cleanRows = rows
      .map(r => ({ name: r.name.trim(), qty: r.qty.trim(), unit: r.unit }))
      .filter(r => r.name && r.qty);
    if (!t) { setErr("Please enter a title."); setStep(0); return; }
    if (cleanRows.length === 0) { setErr("Please add at least one ingredient."); setStep(1); return; }

    // pack like { name, measure: "100 g" } or "3 pcs"
    const ingredients: Ingredient[] = cleanRows.map(r => ({
      name: r.name,
      measure: `${r.qty} ${r.unit}`.trim(),
    }));

    const instructionsText = steps
      .map((s,i)=> s.trim() ? `${i+1}) ${s.trim()}` : "")
      .filter(Boolean)
      .join("\n");

    const payload = {
      uid: meUid,
      author: { uid: meUid, name: auth.currentUser?.displayName || null } as { uid: string; name: string | null },
      title: t,
      titleLower: t.toLowerCase(),
      image: null as string | null,
      category: null as string | null,
      area: null as string | null,
      ingredients,
      instructions: instructionsText || null,
      createdAt: serverTimestamp(),
    };

    setBusy(true); setErr(null);
    try {
      const refDoc = await addDoc(collection(db, "recipes"), payload);
      if (imgFile) {
        const path = `recipeImages/${meUid}/${refDoc.id}/cover`;
        const storageRef = sref(storage, path);
        await uploadBytes(storageRef, imgFile, { contentType: imgFile.type });
        const url = await getDownloadURL(storageRef);
        await updateDoc(refDoc, { image: url });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save recipe.");
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="wiz" onClick={(e)=>e.stopPropagation()}>
        <header className="header">
          <div className="title">Create recipe</div>
          <div className="dots">{[0,1,2,3].map(i => <span key={i} className={`dot ${i<=step?"on":""}`} />)}</div>
        </header>

        {step===0 && (
          <section className="slide">
            <Input label="Title" value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Best Tomato Pasta" />
            <div>
              <label className="lab">Cover photo <span className="muted small">(optional)</span></label>
              {imgPrev ? (
                <div className="pick">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="cover" src={imgPrev} alt="preview" />
                  <Button variant="secondary" size="sm" onClick={()=>{ setImgPrev(null); setImgFile(null); }}>Remove</Button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={onPick} />
              )}
            </div>
          </section>
        )}

        {step===1 && (
          <section className="slide">
            <h3 className="h3">Ingredients</h3>
            <div className="rows">
              {rows.map((r, i) => (
                <div key={i} className="row">
                  <input className="name" placeholder="Ingredient (e.g. Tomato)"
                         value={r.name} onChange={(e)=>setRow(i,{name:e.currentTarget.value})} />
                  <input className="qty" type="number" min={0} placeholder="Qty"
                         value={r.qty} onChange={(e)=>setRow(i,{qty:e.currentTarget.value})} />
                  <select className="unit" value={r.unit} onChange={(e)=>setRow(i,{unit: e.currentTarget.value as Row["unit"]})}>
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
              <Button variant="secondary" onClick={addRow}>Add ingredient</Button>
            </div>
          </section>
        )}

        {step===2 && (
          <section className="slide">
            <h3 className="h3">Instructions</h3>
            <div className="steps">
              {steps.map((s, i) => (
                <div key={i} className="stepRow">
                  <div className="num">{i+1})</div>
                  <input className="stepInput" placeholder="Write step…" value={s}
                         onChange={(e)=>setStepText(i,e.currentTarget.value)} />
                  <button className="minus" onClick={()=>removeStep(i)} aria-label="Remove">−</button>
                </div>
              ))}
            </div>
            <div className="footerRow">
              <Button variant="secondary" onClick={addStep}>Add step</Button>
            </div>
          </section>
        )}

        {step===3 && (
          <section className="slide">
            <h3 className="h3">Review</h3>
            <div className="review">
              <div><strong>Title:</strong> {title || <em>(missing)</em>}</div>
              <div><strong>Ingredients:</strong>
                <ul className="ul">{rows.filter(r=>r.name && r.qty).map((r,i)=><li key={i}>{r.name} — {r.qty} {r.unit}</li>)}</ul>
              </div>
              <div><strong>Instructions:</strong>
                <ul className="ul">{steps.filter(Boolean).map((s,i)=><li key={i}>{i+1}) {s}</li>)}</ul>
              </div>
            </div>
          </section>
        )}

        {err && <p className="error">{err}</p>}

        <footer className="actions">
          {step>0 ? (
            <Button variant="secondary" onClick={()=>setStep((s)=>((s-1) as any))}>Back</Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          )}
          {step<3 ? (
            <Button onClick={()=>setStep((s)=>((s+1) as any))}>Next</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={()=>setStep(0)}>No, go back</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Yes, save recipe"}</Button>
            </>
          )}
        </footer>
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:1450}
        .wiz{width:100%;max-width:820px;max-height:92vh;overflow:auto;background:var(--card-bg);border-radius:16px;border:1px solid var(--border);box-shadow:0 20px 50px rgba(2,6,23,.18)}
        .header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:12px 14px;background:color-mix(in oklab, var(--card-bg) 85%, #fff)}
        .title{font-weight:800;color:var(--text)}
        .dots{display:flex;gap:6px}
        .dot{width:10px;height:10px;border-radius:999px;background:#e5e7eb}.dot.on{background:var(--primary)}
        .slide{padding:14px;display:grid;gap:10px}
        .lab{display:block;margin:8px 0 6px;font-weight:600}
        .pick{display:flex;align-items:center;gap:12px}
        .cover{width:160px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--border)}
        .h3{margin:6px 0 2px;color:var(--text)}
        .rows{display:grid;gap:8px}
        .row{display:grid;grid-template-columns:1fr 100px 110px 34px;gap:8px}
        .name,.qty,.unit{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg2);color:var(--text)}
        .minus{border:0;background:#ef4444;color:#fff;border-radius:10px;cursor:pointer}
        .footerRow{display:flex;justify-content:flex-end}
        .steps{display:grid;gap:8px}
        .stepRow{display:grid;grid-template-columns:44px 1fr 34px;gap:8px;align-items:center}
        .num{font-weight:800;color:var(--text);text-align:center}
        .stepInput{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg2);color:var(--text)}
        .review{border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--bg2)}
        .ul{margin:6px 0 0; padding-left:18px}
        .actions{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);padding:12px 14px;background:color-mix(in oklab, var(--card-bg) 92%, #fff)}
        .error{margin:8px 14px 0;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:13px}
      `}</style>
    </div>
  );
}

/* =========================================================================
   FAVORITES OVERLAY (unchanged)
   ========================================================================= */
function FavOverlay({
  uid, onClose, onOpen,
}: {
  uid: string | null;
  onClose: () => void;
  onOpen: (id: string, source: "api" | "user", recipeId: string) => void;
}) {
  const [rows, setRows] = useState<
    { id: string; title: string; image: string | null; source: "api" | "user"; recipeId: string }[]
  >([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "favoriteRecipes"));
    const stop = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title || "Untitled",
          image: data.image || null,
          source: (data.source as "api" | "user") || "api",
          recipeId: String(data.recipeId || ""),
        };
      });
      setRows(list);
    });
    return () => stop();
  }, [uid]);

  async function removeFav(favId: string) {
    if (!uid) return;
    const ref = doc(db, "users", uid, "favoriteRecipes", favId);
    await deleteDoc(ref).catch(() => {});
  }

  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="box" onClick={(e)=>e.stopPropagation()}>
        <div className="bh"><div className="bt">Favorites</div><button className="x" onClick={onClose}>✕</button></div>
        {!uid ? (
          <p className="muted small" style={{ padding: 12 }}>Sign in to view favorites.</p>
        ) : rows.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>No favorites yet.</p>
        ) : (
          <div className="gridFav">
            {rows.map((r) => (
              <div key={r.id} className="fi">
                {r.image ? <img className="fimg" src={r.image} alt={r.title} /> : <div className="fimg" />}
                <div className="ft">{r.title}</div>
                <div className="btns">
                  <button className="open" onClick={() => onOpen(r.id, r.source, r.recipeId)}>Open</button>
                  <button className="unfav" onClick={() => removeFav(r.id)} title="Remove">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:1500}
        .box{width:100%;max-width:760px;max-height:90vh;overflow:auto;background:var(--card-bg);border-radius:16px;border:1px solid var(--border)}
        .bh{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:10px 12px}
        .bt{font-weight:800;color:var(--text)}
        .x{border:none;background:var(--text);color:var(--primary-contrast);border-radius:10px;padding:4px 10px;cursor:pointer}
        .gridFav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px}
        @media (max-width:840px){ .gridFav{grid-template-columns:repeat(2,minmax(0,1fr));} }
        @media (max-width:560px){ .gridFav{grid-template-columns:1fr;} }
        .fi{border:1px solid var(--border);border-radius:12px;background:var(--bg2);overflow:hidden;display:flex;flex-direction:column}
        .fimg{width:100%;height:120px;object-fit:cover;background:#eee}
        .ft{padding:8px 10px;font-weight:700;flex:1;color:var(--text)}
        .btns{display:flex;gap:8px;justify-content:flex-end;padding:0 10px 10px}
        .open{border:1px solid var(--border);background:var(--bg2);border-radius:8px;padding:6px 10px;cursor:pointer}
        .unfav{border:1px solid rgb(249,201,6);background:#fef9c3;border-radius:8px;padding:6px 10px;cursor:pointer}
      `}</style>
    </div>
  );
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function RecipesPage() {
  const [me, setMe] = useState<string | null>(auth.currentUser?.uid ?? null);

  // lists
  const [apiRecipes, setApiRecipes] = useState<CommonRecipe[]>([]);
  const [userRecipes, setUserRecipes] = useState<CommonRecipe[]>([]);
  const [pantryRecipes, setPantryRecipes] = useState<CommonRecipe[] | null>(null);

  // favorites
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [showFavs, setShowFavs] = useState(false);

  // pantry names
  const [pantry, setPantry] = useState<string[]>([]);

  // search + filters
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"name" | "ingredient">("name");
  const [areaFilter, setAreaFilter] = useState<string>("any"); // world-wide feel
  const [busySearch, setBusySearch] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // modals
  const [openModal, setOpenModal] = useState<CommonRecipe | null>(null);
  const [showPantryPicker, setShowPantryPicker] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // card expansion
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  /* ---------- auth + listeners ---------- */
  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      setMe(u?.uid ?? null);

      if (u) {
        const qMine = query(collection(db, "recipes"), where("uid", "==", u.uid));
        const stopUser = onSnapshot(
          qMine,
          (snap) => {
            const rows = snap.docs
              .map((d) => {
                const data = d.data() as any;
                const r: CommonRecipe = {
                  id: d.id,
                  source: "user",
                  title: data.title || "Untitled",
                  image: data.image || data.imageURL || null,
                  category: data.category || null,
                  area: data.area || null,
                  ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
                  instructions: data.instructions || null,
                  author: { uid: data.uid || data.author?.uid || u.uid, name: data.author?.name || null },
                };
                (r as any)._cts = data.createdAt?.seconds || 0;
                return r;
              })
              .sort((a: any, b: any) => b._cts - a._cts);
            setUserRecipes(rows);
          },
          () => {}
        );

        const fq = query(collection(db, "users", u.uid, "favoriteRecipes"));
        const stopFavs = onSnapshot(fq, (snap) => {
          const map: Record<string, boolean> = {};
          snap.docs.forEach((d) => (map[d.id] = true));
          setFavs(map);
        });

        const pq = query(collection(db, "pantryItems"), where("uid", "==", u.uid));
        const stopPantry = onSnapshot(pq, (snap) => {
          const names = snap.docs
            .map((d) => (d.data() as any)?.name || "")
            .filter(Boolean)
            .map((n) => n.toLowerCase());
          const uniq = Array.from(new Set(names)).sort((a,b)=>a.localeCompare(b));
          setPantry(uniq);
        });

        return () => { stopUser(); stopFavs(); stopPantry(); };
      } else {
        setUserRecipes([]); setFavs({}); setPantry([]);
      }
    });

    return () => stopAuth();
  }, []);

  /* ---------- initial API list ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getRandomMeals(15);
        if (alive) setApiRecipes(list);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  /* ---------- search ---------- */
  useEffect(() => {
    const id = setTimeout(async () => {
      setErr(null);
      setPantryRecipes(null);
      if (!q.trim()) {
        const list = await getRandomMeals(15);
        setApiRecipes(list);
        setBusySearch(false);
        return;
      }
      setBusySearch(true);
      try {
        const list = mode === "ingredient"
          ? await searchMealsByIngredient(q.trim())
          : await searchMealsByName(q.trim());
        setApiRecipes(list);
      } catch (e: any) {
        setErr(e?.message || "Search failed.");
      } finally {
        setBusySearch(false);
      }
    }, 280);
    return () => clearTimeout(id);
  }, [q, mode]);

  /* ---------- pantry picker → AND search ---------- */
  async function runPantrySearch(terms: string[]) {
    setErr(null);
    setBusySearch(true);
    setShowPantryPicker(false);
    try {
      const results = await searchMealsByIngredientsAND(terms, 36);
      setPantryRecipes(results);
    } catch (e: any) {
      setErr(e?.message || "Pantry search failed.");
    } finally {
      setBusySearch(false);
    }
  }

  /* ---------- favorites ---------- */
  async function toggleFav(r: CommonRecipe) {
    const uid = me;
    if (!uid) { alert("Please sign in to favorite."); return; }
    const id = ridFor(r);
    const ref = doc(db, "users", uid, "favoriteRecipes", id);
    if (favs[id]) {
      await deleteDoc(ref).catch(() => {});
    } else {
      await setDoc(ref, {
        title: r.title,
        image: r.image || null,
        source: r.source,
        recipeId: r.id,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  async function openFavorite(id: string, source: "api" | "user", recipeId: string) {
    if (source === "api") {
      const hit =
        visibleRecipes.find((r) => r.source === "api" && r.id === recipeId) ||
        apiRecipes.find((r) => r.source === "api" && r.id === recipeId);
      if (hit) return setOpenModal(hit);
      const full = await lookupMealById(recipeId);
      if (full) setOpenModal(full);
    } else {
      const ref = doc(db, "recipes", recipeId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setOpenModal({
          id: snap.id,
          source: "user",
          title: data.title || "Untitled",
          image: data.image || data.imageURL || null,
          category: data.category || null,
          area: data.area || null,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          instructions: data.instructions || null,
          author: { uid: data.uid || null, name: data.author?.name || null },
        });
      }
    }
    setShowFavs(false);
  }

  /* ---------- merge + local filter on user recipes ---------- */
  const userFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || mode !== "name") return userRecipes;
    return userRecipes.filter(r => (r.title || "").toLowerCase().includes(s));
  }, [userRecipes, q, mode]);

  // combine: show pantryResults if present; otherwise API + user (user first)
  const combined = useMemo(() => {
    if (pantryRecipes) return pantryRecipes;
    return [...userFiltered, ...apiRecipes];
  }, [pantryRecipes, userFiltered, apiRecipes]);

  // area filter choices from combined list
  const areas = useMemo(() => {
    const set = new Set<string>();
    combined.forEach(r => { if (r.area) set.add(String(r.area)); });
    return ["any", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  }, [combined]);

  const visibleRecipes = useMemo(() => {
    if (areaFilter === "any") return combined;
    return combined.filter(r => (r.area || "").toLowerCase() === areaFilter.toLowerCase());
  }, [combined, areaFilter]);

  return (
    <main className="container">
      <div className="topbar">
        <h1 className="title">Recipes</h1>
        <div className="right">
          <button className="linkBtn" onClick={() => setShowPantryPicker(true)}>Find with my pantry</button>
          <button className="linkBtn" onClick={() => setShowWizard(true)}>Create recipe</button>
          <button className="linkBtn" onClick={() => setShowFavs(true)}>favorites</button>
        </div>
      </div>

      {/* controls */}
      <section className="card controls" aria-label="Search and actions">
        <div className="row">
          <div className="seg">
            <button className={`segBtn ${mode === "name" ? "active" : ""}`} onClick={() => setMode("name")} type="button">
              By name
            </button>
            <button className={`segBtn ${mode === "ingredient" ? "active" : ""}`} onClick={() => setMode("ingredient")} type="button">
              By ingredient
            </button>
          </div>

          <div className="grow">
            <div className="wave-group">
              <input required type="text" className="input" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
              <span className="bar" />
              <label className="label" aria-hidden>
                {["S","e","a","r","c","h"].map((ch, i) => (
                  <span className="label-char" style={{ ["--index" as any]: i }} key={i}>{ch}</span>
                ))}
              </label>
            </div>
          </div>

          <div className="filters">
            <label className="small muted">Area</label>
            <select value={areaFilter} onChange={(e)=>setAreaFilter(e.currentTarget.value)} className="select">
              {areas.map(a => <option key={a} value={a}>{a === "any" ? "Any area" : a}</option>)}
            </select>
          </div>

          <div className="actionsRow">
            <Button variant="secondary" onClick={() => setShowPantryPicker(true)}>Find with my pantry</Button>
            <Button onClick={() => setShowWizard(true)}>Create recipe</Button>
          </div>
        </div>

        {busySearch && <p className="muted small">Searching…</p>}
        {err && <p className="error">{err}</p>}
        {pantryRecipes && <p className="muted small">Showing suggestions from your pantry.</p>}
      </section>

      {/* GRID */}
      <section className="list">
        <div className="gridCards">
          {visibleRecipes.map((r, idx) => {
            const fav = favs[ridFor(r)];
            const key = `${r.source}-${r.id}`;
            const isOpen = expandedKey === key;
            const isLastCol = ((idx + 1) % 3) === 0;

            const ingredientsList: IngredientObj[] = Array.isArray(r.ingredients)
              ? r.ingredients.map((i: any) => ({ name: i?.name || "", measure: i?.measure || "" }))
              : [];
            const stepsList = r.instructions ? String(r.instructions).split("\n").filter(Boolean) : [];
            const imageUrl = (r as any).image || (r as any).imageURL || "";

            const minutes = (r as any).minutes ?? null;
            const baseServings = (r as any).servings ?? 2;

            return (
              <div key={key} className={`cardWrap ${isOpen && !isLastCol ? "span2" : ""}`}>
                <RecipeCard
                  title={r.title}
                  imageUrl={imageUrl || "/placeholder.png"}
                  ingredients={ingredientsList}
                  steps={stepsList}
                  open={isOpen}
                  onOpen={() => setExpandedKey(key)}
                  onClose={() => setExpandedKey(null)}
                  panelPlacement={isLastCol ? "overlay-right" : "push"}
                  minutes={minutes}
                  baseServings={baseServings}
                  isFavorite={!!fav}
                  onToggleFavorite={() => toggleFav(r)}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal */}
      {openModal ? (
        <RecipeModal
          recipe={openModal}
          onClose={() => setOpenModal(null)}
          isFavorite={!!favs[ridFor(openModal)]}
          onToggleFavorite={(r) => toggleFav(r)}
        />
      ) : null}

      {/* Overlays */}
      {showPantryPicker && (
        <PantryPicker
          open={showPantryPicker}
          onClose={() => setShowPantryPicker(false)}
          allItems={pantry}
          onSearch={runPantrySearch}
          busy={busySearch}
        />
      )}

      {showWizard && (
        <CreateRecipeWizard
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onSaved={() => {}}
          meUid={me}
        />
      )}

      {showFavs && (
        <FavOverlay
          uid={me}
          onClose={() => setShowFavs(false)}
          onOpen={(id, source, recipeId) => openFavorite(id, source, recipeId)}
        />
      )}

      <style jsx>{`
        .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
        .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .title{font-size:28px;font-weight:800;margin:0}
        .right{display:flex;gap:10px}
        .linkBtn{border:none;background:none;color:var(--text);text-decoration:underline;cursor:pointer;font-size:13px}

        .card { border:1px solid var(--border); background:var(--card-bg); border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.04); }
        .controls .row{display:grid;align-items:end;grid-template-columns:auto 1fr auto auto;gap:14px;flex-wrap:wrap}
        .actionsRow{display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end}
        .filters{display:grid;gap:4px;align-items:end}
        .select{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg2);color:var(--text)}

        .seg{display:inline-grid; grid-auto-flow:column; gap:0; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--bg2);}
        .segBtn{padding:10px 12px; font-weight:700; border:0; background:transparent; color:var(--text); cursor:pointer;}
        .segBtn + .segBtn{border-left:1px solid var(--border);}
        .segBtn.active{ background:var(--primary); color:var(--primary-contrast); }

        .wave-group { position:relative; max-width: 520px; }
        .wave-group .input { font-size:16px; padding:12px 10px 10px 6px; display:block; width:100%;
          border:none; border-bottom:1px solid var(--border); background:transparent; color:var(--text); }
        .wave-group .input:focus { outline:none; }
        .wave-group .label { color:var(--muted); font-size:18px; position:absolute; pointer-events:none; left:6px; top:10px; display:flex; }
        .wave-group .label-char { transition:.2s ease all; transition-delay: calc(var(--index) * .05s); }
        .wave-group .input:focus ~ label .label-char,
        .wave-group .input:valid ~ label .label-char { transform: translateY(-20px); font-size:14px; color: var(--primary); }
        .wave-group .bar { position:relative; display:block; width:100%; }
        .wave-group .bar:before, .wave-group .bar:after { content:""; height:2px; width:0; bottom:1px; position:absolute; background: var(--primary); transition:.2s ease all; }
        .wave-group .bar:before { left:50%; } .wave-group .bar:after { right:50%; }
        .wave-group .input:focus ~ .bar:before, .wave-group .input:focus ~ .bar:after { width:50%; }

        .muted{color:var(--muted)} .small{font-size:12px}
        .error{margin-top:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:13px}

        .list{margin-top:12px}
        .gridCards{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(440px, auto); gap: 22px; overflow: visible; }
        .cardWrap{ position: relative; overflow: visible; }
        .cardWrap.span2 { grid-column: span 2; }
      `}</style>
    </main>
  );
}
