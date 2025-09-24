"use client";

import { useEffect, useState } from "react";
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
  getRandomMeals, searchMealsByIngredient, searchMealsByName, lookupMealById,
} from "@/lib/recipesApi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/* ---------------- helpers ---------------- */
const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());

function parseIngredientsText(text: string): Ingredient[] {
  const SEP = /\s*(?:—|–|:|-)\s*/;
  return text
    .split("\n").map((l) => l.trim()).filter(Boolean)
    .map((line) => {
      const parts = line.split(SEP);
      const name = (parts[0] || "").trim();
      const measure = (parts[1] || "").trim();
      if (!name) return { name: "" };
      return measure ? { name, measure } : { name };
    })
    .filter((i) => i.name);
}
function packIngredients(list: Ingredient[]): Array<{ name: string; measure?: string | null }> {
  return list.map((i) => (i.measure ? { name: i.name, measure: i.measure } : { name: i.name }));
}
function ridFor(r: CommonRecipe) {
  return r.source === "api" ? `api-${r.id}` : `user-${r.id}`;
}
function pantryTerms(names: string[], max = 6): string[] {
  const stops = new Set(["and", "of", "with", "the"]);
  const uniq = new Set<string>();
  for (const n of names) {
    const bits = n.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/).filter(Boolean).filter((w) => !stops.has(w));
    const key = bits[bits.length - 1] || n.toLowerCase();
    if (!uniq.has(key)) uniq.add(key);
    if (uniq.size >= max) break;
  }
  return Array.from(uniq);
}

/* ---------------- page ---------------- */
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

  // search
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"name" | "ingredient">("name");
  const [busySearch, setBusySearch] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // modal + add form
  const [openModal, setOpenModal] = useState<CommonRecipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tIngredients, setTIngredients] = useState("");
  const [tInstructions, setTInstructions] = useState("");

  // cover image
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  // delete feedback
  const [delBusyId, setDelBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // grid card expansion
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // prevent background scroll when a modal/overlay is open
  useEffect(() => {
    const lock = openModal || showFavs;
    const prev = document.body.style.overflow;
    document.body.style.overflow = lock ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev || ""; };
  }, [openModal, showFavs]);

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
          (e) => console.error("User recipes listener error:", e)
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
          setPantry(names);
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

  /* ---------- pantry suggestions ---------- */
  async function loadPantrySuggestions() {
    setErr(null);
    setBusySearch(true);
    try {
      const terms = pantryTerms(pantry, 6);
      if (terms.length === 0) {
        setPantryRecipes([]);
        setBusySearch(false);
        return;
      }
      const lists = await Promise.all(terms.map((t) => searchMealsByIngredient(t, 12)));
      const seen = new Set<string>();
      const merged: CommonRecipe[] = [];
      for (const arr of lists) {
        for (const r of arr) {
          const k = `api-${r.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
        }
      }
      setPantryRecipes(merged);
    } catch (e: any) {
      setErr(e?.message || "Pantry search failed.");
    } finally {
      setBusySearch(false);
    }
  }

  const visibleRecipes = pantryRecipes ?? apiRecipes;

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

  /* ---------- open favorite from popup ---------- */
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

  /* ---------- add user recipe ---------- */
  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0] || null;
    if (!f) return;
    setImgFile(f);
    const url = URL.createObjectURL(f);
    setImgPreview(url);
  }
  function clearPickedImage() {
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview(null);
    setImgFile(null);
  }

  async function addRecipe() {
    if (!me) return alert("Please sign in.");
    setAddErr(null);

    const title = capFirst(tTitle.trim());
    if (!title) return setAddErr("Please enter a title.");

    const ingredients = packIngredients(parseIngredientsText(tIngredients));
    const instructions = tInstructions.trim() || null;

    const basePayload = {
      uid: me,
      title,
      image: null as string | null,
      category: null as string | null,
      area: null as string | null,
      ingredients,
      instructions,
      author: { uid: me, name: auth.currentUser?.displayName || null } as { uid: string; name: string | null },
      createdAt: serverTimestamp(),
    };

    setAddBusy(true);
    try {
      const refDoc = await addDoc(collection(db, "recipes"), basePayload);
      if (imgFile) {
        const path = `recipeImages/${me}/${refDoc.id}/cover`;
        const storageRef = sref(storage, path);
        await uploadBytes(storageRef, imgFile, { contentType: imgFile.type });
        const url = await getDownloadURL(storageRef);
        await updateDoc(refDoc, { image: url });
      }
      setAdding(false);
      setTTitle(""); setTIngredients(""); setTInstructions(""); clearPickedImage();
    } catch (e: any) {
      setAddErr(e?.message ?? "Failed to add recipe.");
    } finally {
      setAddBusy(false);
    }
  }

  /* ---------- delete user recipe ---------- */
  async function deleteRecipe(id: string) {
    if (!me) return alert("Please sign in.");
    setDelBusyId(id); setErr(null);
    try {
      const ref = doc(db, "recipes", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setDelBusyId(null); return; }
      const data = snap.data() as any;
      const owner = data?.uid || data?.author?.uid || null;
      if (owner && owner !== me) { setErr("You can only delete your own recipes."); setDelBusyId(null); return; }
      await deleteDoc(ref);
    } catch (e: any) {
      const code = e?.code || "";
      setErr(code === "permission-denied"
        ? "Permission denied. If this is an old recipe without a 'uid' field, fix the doc or delete via admin."
        : e?.message || "Failed to delete.");
    } finally { setDelBusyId(null); }
  }
  function requestDelete(id: string) { setConfirmDeleteId(id); }
  function cancelDelete() { setConfirmDeleteId(null); }
  async function confirmDelete() { const id = confirmDeleteId; setConfirmDeleteId(null); if (id) await deleteRecipe(id); }

  return (
    <main className="container">
      <div className="topbar">
        <h1 className="title">Recipes</h1>
        <div className="right">
          <button className="linkBtn" onClick={() => setShowFavs(true)}>favorites</button>
        </div>
      </div>

      {/* controls */}
      <section className="card controls" aria-label="Search and actions">
        <div className="row">

          {/* Segmented toggle */}
          <div className="seg">
            <button
              className={`segBtn ${mode === "name" ? "active" : ""}`}
              onClick={() => setMode("name")}
              type="button"
            >
              By name
            </button>
            <button
              className={`segBtn ${mode === "ingredient" ? "active" : ""}`}
              onClick={() => setMode("ingredient")}
              type="button"
            >
              By ingredient
            </button>
          </div>

          {/* Wave search */}
          <div className="grow">
            <div className="wave-group">
              <input
                required
                type="text"
                className="input"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
              />
              <span className="bar" />
              <label className="label" aria-hidden>
                {["S","e","a","r","c","h"].map((ch, i) => (
                  <span className="label-char" style={{ ["--index" as any]: i }} key={i}>{ch}</span>
                ))}
              </label>
            </div>
          </div>

          <div className="actionsRow">
            <Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add recipe"}</Button>
            <Button variant="secondary" onClick={loadPantrySuggestions}>Find with my pantry</Button>
          </div>
        </div>

        {busySearch && <p className="muted small">Searching…</p>}
        {err && <p className="error">{err}</p>}
        {pantryRecipes && (
          <p className="muted small">Showing suggestions from your pantry ({pantryTerms(pantry, 6).join(", ")}).</p>
        )}
      </section>

      {/* add user recipe */}
      {adding && (
        <section className="card addForm">
          <div className="grid">
            <Input
              label="Title (what’s this dish called?)"
              value={tTitle}
              onChange={(e: any) => setTTitle(e.target.value)}
              placeholder="Grandma’s Pasta"
            />
            <div>
              <label className="lab">Cover photo <span className="muted small">(optional)</span></label>
              {imgPreview ? (
                <div className="pick">
                  <img className="cover" src={imgPreview} alt="Cover preview" />
                  <Button variant="secondary" size="sm" onClick={clearPickedImage}>Remove image</Button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={onPickImage} />
              )}
              <div className="muted small">Shown as thumbnail &amp; hero in the recipe.</div>
            </div>

            <div className="full">
              <label className="lab">Ingredients</label>
              <textarea
                className="ta"
                rows={6}
                value={tIngredients}
                onChange={(e) => setTIngredients(e.currentTarget.value)}
                placeholder={`Pasta — 100g\nCucumber — 150g\nOnion — 50g`}
              />
            </div>

            <div className="full">
              <label className="lab">Instructions <span className="muted small">(steps)</span></label>
              <textarea
                className="ta"
                rows={6}
                value={tInstructions}
                onChange={(e) => setTInstructions(e.currentTarget.value)}
                placeholder={`1) Boil pasta\n2) Chop veggies\n3) Mix & serve`}
              />
            </div>
          </div>
          {addErr && <p className="error">{addErr}</p>}
          <div className="actions">
            <Button onClick={addRecipe} disabled={addBusy}>{addBusy ? "Saving…" : "Save recipe"}</Button>
          </div>
        </section>
      )}

      {/* GRID */}
      <section className="list">
        <div className="gridCards">
          {(pantryRecipes ?? apiRecipes).map((r, idx) => {
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

      {/* Modal (still available) */}
      {openModal ? (
        <RecipeModal
          recipe={openModal}
          onClose={() => setOpenModal(null)}
          isFavorite={!!favs[ridFor(openModal)]}
          onToggleFavorite={(r) => toggleFav(r)}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete this recipe?"
        message="This will permanently remove the recipe. You can’t undo this."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

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

        .controls .row{display:grid;align-items:end;grid-template-columns:auto 1fr auto;gap:14px;flex-wrap:wrap}
        .actionsRow{display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end}

        /* segmented toggle */
        .seg{display:inline-grid; grid-auto-flow:column; gap:0; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--bg2);}
        .segBtn{padding:10px 12px; font-weight:700; border:0; background:transparent; color:var(--text); cursor:pointer;}
        .segBtn + .segBtn{border-left:1px solid var(--border);}
        .segBtn.active{ background:var(--primary); color:var(--primary-contrast); }

        /* wave input */
        .wave-group { position:relative; max-width: 520px; }
        .wave-group .input {
          font-size:16px; padding:12px 10px 10px 6px; display:block; width:100%;
          border:none; border-bottom:1px solid var(--border); background:transparent; color:var(--text);
        }
        .wave-group .input:focus { outline:none; }
        .wave-group .label { color:var(--muted); font-size:18px; font-weight:normal; position:absolute; pointer-events:none; left:6px; top:10px; display:flex; }
        .wave-group .label-char { transition:.2s ease all; transition-delay: calc(var(--index) * .05s); }
        .wave-group .input:focus ~ label .label-char,
        .wave-group .input:valid ~ label .label-char { transform: translateY(-20px); font-size:14px; color: var(--primary); }
        .wave-group .bar { position:relative; display:block; width:100%; }
        .wave-group .bar:before, .wave-group .bar:after {
          content:""; height:2px; width:0; bottom:1px; position:absolute; background: var(--primary);
          transition:.2s ease all;
        }
        .wave-group .bar:before { left:50%; }
        .wave-group .bar:after { right:50%; }
        .wave-group .input:focus ~ .bar:before,
        .wave-group .input:focus ~ .bar:after { width:50%; }

        .muted{color:var(--muted)}
        .small{font-size:12px}
        .error{margin-top:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:13px}

        .addForm .grid{display:grid;grid-template-columns:1fr;gap:12px}
        .lab{display:block;margin-bottom:6px;font-size:.9rem;color:#111827;font-weight:500}
        .ta{width:100%;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-size:14px}
        .pick{display:flex;align-items:center;gap:12px}
        .cover{width:140px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--border)}
        .actions { margin-top:10px; display:flex; gap:12px; justify-content:flex-end; }

        /* grid */
        .list{margin-top:12px}
        .gridCards{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: minmax(440px, auto);
          gap: 22px;
          overflow: visible;
        }
        .cardWrap{ position: relative; overflow: visible; }
        .cardWrap.span2 { grid-column: span 2; }
      `}</style>
    </main>
  );
}

/* -------- favorites overlay (unchanged from before) -------- */
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
    <div className="ov" onClick={onClose} role="dialog" aria-modal="true">
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="bh">
          <div className="bt">Favorites</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {!uid ? (
          <p className="muted small" style={{ padding: "12px" }}>Sign in to view favorites.</p>
        ) : rows.length === 0 ? (
          <p className="muted small" style={{ padding: "12px" }}>No favorites yet.</p>
        ) : (
          <div className="gridFav">
            {rows.map((r) => (
              <div key={r.id} className="fi">
                {r.image ? <img className="fimg" src={r.image} alt={r.title} /> : <div className="fimg" />}
                <div className="ft">{r.title}</div>
                <div className="btns">
                  <button className="open" onClick={() => onOpen(r.id, r.source, r.recipeId)}>Open</button>
                  <button className="unfav" onClick={() => removeFav(r.id)} title="Remove from favorites">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:1200}
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
        .unfav{border:1px solid #fde68a;background:#fef9c3;border-radius:8px;padding:6px 10px;cursor:pointer}
      `}</style>
    </div>
  );
}
