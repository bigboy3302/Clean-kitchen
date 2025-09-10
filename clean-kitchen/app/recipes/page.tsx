"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ---------- Types ---------- */
type Ingredient = { name: string; qty?: number; unit?: string | null };
type Author = { username?: string; displayName?: string; avatarURL?: string | null };

type Recipe = {
  id: string;
  uid: string;
  title: string;
  description?: string | null;
  imageURL?: string | null;
  createdAt?: any;
  ingredients?: Ingredient[];
  // optional precomputed field for searching (lowercased names)
  ingredientsNames?: string[];
  author?: Author;
};

type PantryItem = {
  id: string;
  uid: string;
  name: string;
  quantity: number;
  createdAt?: any;
  expiresAt?: any;
};

export default function RecipesListPage() {
  const [me, setMe] = useState<{ uid: string } | null>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // search UI state
  const [q, setQ] = useState("");
  const [usePantryTerms, setUsePantryTerms] = useState(false);

  /* ---------- Auth ---------- */
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => setMe(u ? { uid: u.uid } : null));
    return () => stop();
  }, []);

  /* ---------- Recipes (public) ---------- */
  useEffect(() => {
    const qr = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(qr, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
      setRecipes(list);
    });
    return () => stop();
  }, []);

  /* ---------- Pantry (for “Use my pantry” search) ---------- */
  useEffect(() => {
    if (!me) { setPantry([]); return; }
    const qp = query(
      collection(db, "pantryItems"),
      where("uid", "==", me.uid),
      orderBy("createdAt", "desc")
    );
    const stop = onSnapshot(qp, (snap) => {
      setPantry(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PantryItem[]);
    });
    return () => stop();
  }, [me]);

  /* ---------- Favorites (users/{uid}/favoriteRecipes/{recipeId}) ---------- */
  useEffect(() => {
    if (!me) { setFavoriteIds(new Set()); return; }
    const qf = collection(db, "users", me.uid, "favoriteRecipes");
    const stop = onSnapshot(qf, (snap) => {
      const ids = new Set<string>(snap.docs.map((d) => d.id));
      setFavoriteIds(ids);
    });
    return () => stop();
  }, [me]);

  /* ---------- Build search terms ---------- */
  const uiTerms = useMemo(() => {
    const manualTerms = q
      .toLowerCase()
      .split(/[, ]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const pantryTerms = usePantryTerms
      ? Array.from(
          new Set(
            pantry
              .map((p) => p.name?.toLowerCase().trim())
              .filter(Boolean) as string[]
          )
        )
      : [];

    return Array.from(new Set([...manualTerms, ...pantryTerms]));
  }, [q, usePantryTerms, pantry]);

  /* ---------- Helpers ---------- */
  function ingredientNames(r: Recipe): string[] {
    if (Array.isArray(r.ingredientsNames) && r.ingredientsNames.length) {
      return r.ingredientsNames.map((s) => s.toLowerCase());
    }
    if (Array.isArray(r.ingredients) && r.ingredients.length) {
      return r.ingredients
        .map((i) => (i?.name || "").toLowerCase().trim())
        .filter(Boolean);
    }
    return [];
  }

  /* ---------- Filter recipes ---------- */
  const filtered = useMemo(() => {
    if (uiTerms.length === 0) return recipes;
    return recipes.filter((r) => {
      const names = ingredientNames(r);
      if (names.length === 0) return false;
      // every search term must be included in at least one ingredient name
      return uiTerms.every((term) => names.some((n) => n.includes(term)));
    });
  }, [recipes, uiTerms]);

  // favorites at the top
  const favorites = useMemo(
    () => filtered.filter((r) => favoriteIds.has(r.id)),
    [filtered, favoriteIds]
  );
  const others = useMemo(
    () => filtered.filter((r) => !favoriteIds.has(r.id)),
    [filtered, favoriteIds]
  );

  /* ---------- Toggle favorite ---------- */
  async function toggleFavorite(recipeId: string) {
    if (!me) return; // optionally route to login
    const favRef = doc(db, "users", me.uid, "favoriteRecipes", recipeId);
    if (favoriteIds.has(recipeId)) {
      await deleteDoc(favRef);
    } else {
      await setDoc(favRef, { createdAt: serverTimestamp() });
    }
  }

  return (
    <main className="wrap">
      <h1 className="title">Recipes</h1>

      {/* Search */}
      <section className="searchCard">
        <div className="row">
          <div className="col">
            <label className="label">Search by ingredients</label>
            <input
              className="textInput"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. tomato, garlic, pasta"
            />
            <div className="hint">
              Separate by comma or space. We’ll match ingredient names that include those words.
            </div>
          </div>

          <div className="col small">
            <label className="label">&nbsp;</label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={usePantryTerms}
                onChange={(e) => setUsePantryTerms(e.target.checked)}
                disabled={!me || pantry.length === 0}
              />
              Use my pantry
            </label>

            {!!me && pantry.length > 0 && usePantryTerms && (
              <div className="chips">
                {Array.from(
                  new Set(
                    pantry
                      .map((p) => p.name?.toLowerCase().trim())
                      .filter(Boolean) as string[]
                  )
                ).map((name) => (
                  <span className="chip" key={name}>{name}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={() => setQ("")}>Clear</button>
          <button
            className="btn"
            onClick={() => setUsePantryTerms((v) => !v)}
            disabled={!me || pantry.length === 0}
          >
            {usePantryTerms ? "Remove pantry terms" : "Add pantry terms"}
          </button>
        </div>
      </section>

      {/* Favorites */}
      {favorites.length > 0 && (
        <>
          <h2 className="h2">My favorites</h2>
          <ul className="grid">
            {favorites.map((r) => (
              <RecipeCard
                key={r.id}
                r={r}
                isFav={favoriteIds.has(r.id)}
                onToggleFav={() => toggleFavorite(r.id)}
              />
            ))}
          </ul>
        </>
      )}

      {/* Matches / All */}
      <h2 className="h2" style={{ marginTop: favorites.length ? 10 : 0 }}>
        {uiTerms.length ? "Matches" : "All recipes"}
      </h2>
      {others.length === 0 && favorites.length === 0 ? (
        <p className="muted">No recipes found.</p>
      ) : (
        <ul className="grid">
          {others.map((r) => (
            <RecipeCard
              key={r.id}
              r={r}
              isFav={favoriteIds.has(r.id)}
              onToggleFav={() => toggleFavorite(r.id)}
            />
          ))}
        </ul>
      )}

      <style jsx>{`
        .wrap { max-width: 1000px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 800; margin-bottom: 12px; }
        .h2 { font-size: 18px; font-weight: 700; margin: 16px 0 10px; color:#0f172a; }
        .muted { color:#6b7280; }

        .searchCard { border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:12px; margin-bottom:12px; }
        .row { display:grid; grid-template-columns: 1fr 280px; gap:12px 16px; }
        @media (max-width: 820px){ .row { grid-template-columns: 1fr; } }
        .col.small { align-self:end; }
        .label { display:block; margin-bottom:6px; font-weight:600; color:#0f172a; }
        .textInput { width:100%; border:1px solid #d1d5db; border-radius:10px; padding:10px 12px; font-size:14px; }
        .hint { margin-top:6px; font-size:12px; color:#64748b; }

        .checkbox { font-size:14px; color:#0f172a; display:flex; align-items:center; gap:8px; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .chip { border:1px solid #e5e7eb; border-radius:999px; padding:4px 8px; font-size:12px; background:#f8fafc; }

        .actions { display:flex; gap:8px; align-items:center; margin-top:12px; }
        .btn { border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; background:#fff; cursor:pointer; }
        .btn:hover { background:#f8fafc; }

        .grid { list-style:none; padding:0; margin:0; display:grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:16px; }
      `}</style>
    </main>
  );
}

/* ---------- RecipeCard (inline component) ---------- */
function RecipeCard({
  r,
  isFav,
  onToggleFav,
}: {
  r: Recipe;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const authorName =
    r?.author?.username ||
    r?.author?.displayName ||
    (r?.uid ? r.uid.slice(0, 6) : "Unknown");

  return (
    <li className="card">
      <Link href={`/recipes/${r.id}`} className="link">
        {r.imageURL ? <img className="thumb" src={r.imageURL} alt="" /> : <div className="thumb ph" />}
        <div className="meta">
          <div className="top">
            <div className="title2">{r.title || "Untitled"}</div>
            <button
              type="button"
              className={`star ${isFav ? "on" : ""}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
              aria-label={isFav ? "Unstar" : "Star"}
              title={isFav ? "Unstar" : "Star"}
            >
              ★
            </button>
          </div>
          {r.description && <div className="desc">{r.description}</div>}
          {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
            <div className="ings">
              {r.ingredients.slice(0, 4).map((i, idx) => (
                <span className="pill" key={idx}>{i?.name || "ingredient"}</span>
              ))}
              {r.ingredients.length > 4 && <span className="pill more">+{r.ingredients.length - 4}</span>}
            </div>
          )}
          <div className="by">by <strong>{authorName}</strong></div>
        </div>
      </Link>

      <style jsx>{`
        .card { border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#fff; }
        .link { display:block; text-decoration:none; color:inherit; }
        .thumb { width:100%; height:160px; object-fit:cover; border-bottom:1px solid #eef2f7; display:block; }
        .thumb.ph { background:#f1f5f9; }
        .meta { padding:12px; display:grid; gap:6px; }
        .top { display:flex; align-items:center; gap:8px; justify-content:space-between; }
        .title2 { font-weight:700; }
        .desc { color:#4b5563; font-size:14px; }
        .ings { display:flex; gap:6px; flex-wrap:wrap; }
        .pill { border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px; font-size:12px; background:#f8fafc; }
        .pill.more { background:#fff; }
        .by { color:#64748b; font-size:12px; }
        .star { border:none; background:transparent; font-size:20px; line-height:1; cursor:pointer; color:#cbd5e1; }
        .star.on { color:#f59e0b; }
        .star:hover { transform: scale(1.05); }
      `}</style>
    </li>
  );
}
