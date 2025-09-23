// app/recipes/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

import type { CommonRecipe, Ingredient } from "@/components/recipes/types";
import RecipeModal from "@/components/recipes/RecipeModal";
import {
  getRandomMeals,
  searchMealsByIngredient,
  searchMealsByName,
  lookupMealById,
} from "@/lib/recipesApi";
import ConfirmDialog from "@/components/ui/ConfirmDialog"; // ✅ new

/* ---------------- helpers ---------------- */
const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());

/** One-per-line. Accepts “—”, “–”, “-”, “:” as separators between name and measure. */
function parseIngredientsText(text: string): Ingredient[] {
  const SEP = /\s*(?:—|–|:|-)\s*/;
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(SEP);
      const name = (parts[0] || "").trim();
      const measure = (parts[1] || "").trim();
      if (!name) return { name: "" };
      return measure ? { name, measure } : { name };
    })
    .filter((i) => i.name);
}

/** Drop all `undefined` so Firestore never sees it. */
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
    const bits = n
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !stops.has(w));
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
  const [open, setOpen] = useState<CommonRecipe | null>(null);
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null); // ✅

  // prevent background scroll when a modal/overlay is open
  useEffect(() => {
    const lock = open || showFavs;
    const prev = document.body.style.overflow;
    document.body.style.overflow = lock ? "hidden" : prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open, showFavs]);

  /* ---------- auth + live listeners ---------- */
  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      setMe(u?.uid ?? null);

      if (u) {
        // only where("uid","==") to avoid composite index; sort locally by createdAt desc
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
                  image: data.image || null,
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

        // favorites map
        const fq = query(collection(db, "users", u.uid, "favoriteRecipes"));
        const stopFavs = onSnapshot(fq, (snap) => {
          const map: Record<string, boolean> = {};
          snap.docs.forEach((d) => (map[d.id] = true));
          setFavs(map);
        });

        // pantry names
        const pq = query(collection(db, "pantryItems"), where("uid", "==", u.uid));
        const stopPantry = onSnapshot(pq, (snap) => {
          const names = snap.docs
            .map((d) => (d.data() as any)?.name || "")
            .filter(Boolean)
            .map((n) => n.toLowerCase());
          setPantry(names);
        });

        return () => {
          stopUser();
          stopFavs();
          stopPantry();
        };
      } else {
        setUserRecipes([]);
        setFavs({});
        setPantry([]);
      }
    });

    return () => stopAuth();
  }, []);

  /* ---------- initial API list (randoms) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getRandomMeals(15);
        if (alive) setApiRecipes(list);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- search ---------- */
  useEffect(() => {
    const id = setTimeout(async () => {
      setErr(null);
      setPantryRecipes(null); // searching cancels pantry suggestions
      if (!q.trim()) {
        const list = await getRandomMeals(15);
        setApiRecipes(list);
        setBusySearch(false);
        return;
      }
      setBusySearch(true);
      try {
        const list =
          mode === "ingredient"
            ? await searchMealsByIngredient(q.trim())
            : await searchMealsByName(q.trim());
        setApiRecipes(list);
      } catch (e: any) {
        setErr(e?.message || "Search failed.");
      } finally {
        setBusySearch(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [q, mode]);

  /* ---------- find via pantry ---------- */
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

  /* ---------- favorites toggle ---------- */
  async function toggleFav(r: CommonRecipe) {
    const uid = me;
    if (!uid) return alert("Please sign in to favorite.");
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
      if (hit) return setOpen(hit);
      const full = await lookupMealById(recipeId);
      if (full) setOpen(full);
    } else {
      const ref = doc(db, "recipes", recipeId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setOpen({
          id: snap.id,
          source: "user",
          title: data.title || "Untitled",
          image: data.image || null,
          category: data.category || null,
          area: data.area || null,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          instructions: data.instructions || null,
          author: { uid: data.uid || null, name: data.author?.name || null },
        });
      }
    }
    setShowFavs(false); // ensure modal sits on top
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

      // write a FILE, not a folder → '/cover'
      if (imgFile) {
        const path = `recipeImages/${me}/${refDoc.id}/cover`;
        const storageRef = sref(storage, path);
        await uploadBytes(storageRef, imgFile, { contentType: imgFile.type });
        const url = await getDownloadURL(storageRef);
        await updateDoc(refDoc, { image: url });
      }

      setAdding(false);
      setTTitle("");
      setTIngredients("");
      setTInstructions("");
      clearPickedImage();
    } catch (e: any) {
      setAddErr(e?.message ?? "Failed to add recipe.");
    } finally {
      setAddBusy(false);
    }
  }

  /* ---------- delete user recipe ---------- */
  async function deleteRecipe(id: string) {
    if (!me) return alert("Please sign in.");

    setDelBusyId(id);
    setErr(null);
    try {
      const ref = doc(db, "recipes", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setDelBusyId(null);
        return;
      }
      const data = snap.data() as any;
      const owner = data?.uid || data?.author?.uid || null;

      if (owner && owner !== me) {
        setErr("You can only delete your own recipes.");
        setDelBusyId(null);
        return;
      }

      await deleteDoc(ref); // live listener updates UI
    } catch (e: any) {
      const code = e?.code || "";
      setErr(
        code === "permission-denied"
          ? "Permission denied. If this is an old recipe without a 'uid' field, fix the doc or delete via admin."
          : e?.message || "Failed to delete."
      );
    } finally {
      setDelBusyId(null);
    }
  }

  // ✅ open the confirm popup instead of window.confirm
  function requestDelete(id: string) {
    setConfirmDeleteId(id);
  }
  function cancelDelete() {
    setConfirmDeleteId(null);
  }
  async function confirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (id) await deleteRecipe(id);
  }

  return (
    <main className="container">
      <div className="topbar">
        <h1 className="title">Recipes</h1>
        <div className="right">
          <button className="linkBtn" onClick={() => setShowFavs(true)}>
            favorites
          </button>
        </div>
      </div>

      {/* controls */}
      <section className="card controls" aria-label="Search and actions">
        <div className="row">
          <div className="toggles">
            <label className={`chip ${mode === "name" ? "active" : ""}`} onClick={() => setMode("name")}>
              By name
            </label>
            <label className={`chip ${mode === "ingredient" ? "active" : ""}`} onClick={() => setMode("ingredient")}>
              By ingredient
            </label>
          </div>

          <div className="grow">
            <Input
              label="Search"
              value={q}
              onChange={(e: any) => setQ(e.target.value)}
              placeholder={mode === "name" ? "e.g. Pasta" : "e.g. chicken"}
            />
          </div>

          <Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add recipe"}</Button>
          <Button variant="secondary" onClick={loadPantrySuggestions}>
            Find with my pantry
          </Button>
        </div>

        {busySearch && <p className="muted">Loading…</p>}
        {err && <p className="error">{err}</p>}
        {pantryRecipes && (
          <p className="muted small">
            Showing suggestions from your pantry ({pantryTerms(pantry, 6).join(", ")}).
          </p>
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
              <label className="lab">
                Cover photo <span className="muted small">(optional)</span>
              </label>
              {imgPreview ? (
                <div className="pick">
                  <img className="cover" src={imgPreview} alt="Cover preview" />
                  <Button variant="secondary" size="sm" onClick={clearPickedImage}>
                    Remove image
                  </Button>
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
                placeholder={`Pasta — 100g
Cucumber — 150g
Onion — 50g`}
              />
            </div>

            <div className="full">
              <label className="lab">
                Instructions <span className="muted small">(steps)</span>
              </label>
              <textarea
                className="ta"
                rows={6}
                value={tInstructions}
                onChange={(e) => setTInstructions(e.currentTarget.value)}
                placeholder={`1) Boil pasta
2) Chop veggies
3) Mix & serve`}
              />
            </div>
          </div>
          {addErr && <p className="error">{addErr}</p>}
          <div className="actions">
            <Button onClick={addRecipe} disabled={addBusy}>
              {addBusy ? "Saving…" : "Save recipe"}
            </Button>
          </div>
        </section>
      )}

      {/* my recipes row (first line) */}
      {userRecipes.length > 0 && (
        <section className="myRow">
          <h3 className="h3">My recipes</h3>
          <div className="hstrip">
            {userRecipes.map((r) => {
              const fav = favs[ridFor(r)];
              const deleting = delBusyId === r.id;
              return (
                <article key={`u-${r.id}`} className="mini">
                  {r.image ? <img className="mthumb" src={r.image} alt={r.title} /> : <div className="mthumb ph" />}
                  <div className="mbody">
                    <div className="mline">
                      <div className="mt">{r.title}</div>
                      <button className={`star ${fav ? "on" : ""}`} onClick={() => toggleFav(r)} title="Favorite">
                        ★
                      </button>
                    </div>
                    <div className="rowBtns">
                      <button className="open" onClick={() => setOpen(r)}>
                        Open
                      </button>
                      <button className="del" onClick={() => requestDelete(r.id)} disabled={deleting}>
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* all other recipes (API or pantry suggestions) */}
      <section className="list">
        <div className="gridCards">
          {(pantryRecipes ?? apiRecipes).map((r) => {
            const fav = favs[ridFor(r)];
            return (
              <article key={`${r.source}-${r.id}`} className="rcard">
                {r.image ? (
                  <img className="thumb small" src={r.image} alt={r.title} />
                ) : (
                  <div className="thumb small ph" />
                )}
                <div className="body">
                  <div className="row2">
                    <h4 className="rt">{r.title}</h4>
                    <button className={`star ${fav ? "on" : ""}`} title="Favorite" onClick={() => toggleFav(r)}>
                      ★
                    </button>
                  </div>
                  <div className="meta">
                    {r.category ? <span className="chip small">{r.category}</span> : null}
                    {r.area ? <span className="chip small">{r.area}</span> : null}
                    <span className="muted small">{r.source === "api" ? "TheMealDB" : "User"}</span>
                  </div>
                  <button className="open" onClick={() => setOpen(r)}>
                    Open
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ✅ pass favorite props so you can unstar in the modal too */}
      {open ? (
        <RecipeModal
          recipe={open}
          onClose={() => setOpen(null)}
          isFavorite={!!favs[ridFor(open)]}
          onToggleFavorite={(r) => toggleFav(r)}
        />
      ) : null}

      {/* ✅ confirm dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete this recipe?"
        message="This will permanently remove the recipe. You can’t undo this."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {showFavs ? (
        <FavOverlay
          uid={me}
          onClose={() => setShowFavs(false)}
          onOpen={(id, source, recipeId) => openFavorite(id, source, recipeId)}
        />
      ) : null}

      <style jsx>{`
        .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
        .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .title{font-size:28px;font-weight:800;margin:0}
        .right{display:flex;gap:10px}
        .linkBtn{border:none;background:none;color:#0f172a;text-decoration:underline;cursor:pointer;font-size:13px}

        .card { border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.04); }
        .controls .row{display:flex;gap:12px;align-items:end;flex-wrap:wrap}
        .toggles{display:flex;gap:8px}
        .chip{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}
        .chip.active{background:#0f172a;color:#fff;border-color:#0f172a}
        .grow{flex:1 1 360px}
        .muted{color:#64748b}
        .small{font-size:12px}
        .error{margin-top:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:13px}

        .addForm .grid{display:grid;grid-template-columns:1fr;gap:12px}
        .lab{display:block;margin-bottom:6px;font-size:.9rem;color:#111827;font-weight:500}
        .ta{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:10px 12px;font-size:14px}
        .pick{display:flex;align-items:center;gap:12px}
        .cover{width:140px;height:90px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb}
        .actions { margin-top:10px; display:flex; gap:12px; justify-content:flex-end; }

        /* my row */
        .myRow{margin:14px 0}
        .h3{margin:0 0 8px}
        .hstrip{display:flex;gap:12px;overflow:auto;padding:4px}
        .mini{min-width:240px;border:1px solid #eef2f7;border-radius:12px;background:#fff;overflow:hidden}
        .mthumb{width:100%;height:110px;object-fit:cover;background:#eee}
        .mbody{padding:8px}
        .mline{display:flex;align-items:center;gap:8px}
        .mt{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
        .rowBtns{display:flex;gap:8px;margin-top:6px}
        .star{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer}
        .star.on{background:#fde68a;border-color:#f59e0b}
        .open,.del{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer}
        .del{background:#fee2e2;border-color:#fecaca;color:#991b1b}

        /* grid */
        .list{margin-top:12px}
        .gridCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
        @media (max-width: 980px){ .gridCards{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width: 640px){ .gridCards{ grid-template-columns:1fr; } }

        .rcard{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff;display:grid;grid-template-rows:auto 1fr}
        .thumb.small{width:100%;height:120px;object-fit:cover;background:#ddd}
        .thumb.ph{display:block}
        .body{padding:10px}
        .row2{display:flex;align-items:center;gap:8px}
        .rt{margin:0; font-size:16px; font-weight:700; color:#0f172a; flex:1}
        .meta{display:flex;gap:8px;align-items:center;margin:6px 0}
        .chip.small{font-size:12px;padding:2px 8px}
      `}</style>
    </main>
  );
}

/* -------- favorites popup overlay -------- */
function FavOverlay({
  uid,
  onClose,
  onOpen,
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

  // ✅ allow unfavorite directly from overlay
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
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="muted small" style={{ padding: "8px 12px" }}>
            No favorites yet.
          </p>
        ) : (
          <div className="gridFav">
            {rows.map((r) => (
              <div key={r.id} className="fi">
                {r.image ? <img className="fimg" src={r.image} alt={r.title} /> : <div className="fimg" />}
                <div className="ft">{r.title}</div>
                <div className="btns">
                  <button className="open" onClick={() => onOpen(r.id, r.source, r.recipeId)}>
                    Open
                  </button>
                  <button className="unfav" onClick={() => removeFav(r.id)} title="Remove from favorites">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:1200}
        .box{width:100%;max-width:760px;max-height:90vh;overflow:auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb}
        .bh{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eef2f7;padding:10px 12px}
        .bt{font-weight:800;color:#0f172a}
        .x{border:none;background:#0f172a;color:#fff;border-radius:10px;padding:4px 10px;cursor:pointer}
        .gridFav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px}
        @media (max-width:840px){ .gridFav{grid-template-columns:repeat(2,minmax(0,1fr));} }
        @media (max-width:560px){ .gridFav{grid-template-columns:1fr;} }
        .fi{border:1px solid #eef2f7;border-radius:12px;background:#fff;overflow:hidden;display:flex;flex-direction:column}
        .fimg{width:100%;height:120px;object-fit:cover;background:#eee}
        .ft{padding:8px 10px;font-weight:700;flex:1}
        .btns{display:flex;gap:8px;justify-content:flex-end;padding:0 10px 10px}
        .open{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
        .unfav{border:1px solid #fde68a;background:#fef9c3;border-radius:8px;padding:6px 10px;cursor:pointer}
      `}</style>
    </div>
  );
}
