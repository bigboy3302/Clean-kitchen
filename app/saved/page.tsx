"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebas1e";

type SavedFood = {
  source?: "internal" | "external" | "api" | "themealdb";
  id?: string;
  recipeId?: number | string;
  title: string;
  imageURL?: string | null;
  image?: string | null;
  timeMinutes?: number | null;
  readyInMinutes?: number | null;
  servings?: number | null;
  sourceUrl?: string | null;
};

export default function SavedPage() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [items, setItems] = useState<SavedFood[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "users", uid, "savedFoods"), orderBy("savedAt", "desc"));

    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => d.data() as SavedFood));
      setLoading(false);
    });
  }, [uid]);

  const remove = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "savedFoods", id));
  };

  return (
    <main className="container section recipesPage">
      <div className="spaced" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Saved Foods</h1>
        <Link className="btn-base btn--secondary btn--sm" href="/recipes">
          Browse
        </Link>
      </div>

      {loading && <div className="card">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card">
          <h2>No saved foods yet</h2>
          <p className="muted">Save foods to find them here.</p>
          <Link className="btn-base btn--primary btn--md" href="/recipes">
            Find recipes
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="recipeGrid">
          {items.map((r, index) => {
            const rawId = String(r.id ?? r.recipeId ?? "");
            const isNumeric = /^\d+$/.test(rawId);
            const source = r.source ?? (isNumeric ? "themealdb" : "internal");
            const isExternal = source === "themealdb" || source === "external" || source === "api";
            const href = isExternal ? `/recipes/ext/${rawId}` : `/recipes/${rawId}`;
            const image = r.imageURL ?? r.image ?? null;
            const timeMinutes = r.timeMinutes ?? r.readyInMinutes ?? null;

            return (
              <article className="recipeCard" key={`${rawId}-${index}`}>
              <div className="recipeMedia">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="recipeImg" src={image} alt={r.title} />
                ) : (
                  <div className="skelMedia" />
                )}
              </div>

              <div className="recipeBody">
                <div className="recipeTitleRow">
                  <h3 className="recipeTitle">{r.title}</h3>
                </div>

                <div className="recipeMeta">
                  {!!timeMinutes && (
                    <span className="recipePill">{timeMinutes} min</span>
                  )}
                  {!!r.servings && (
                    <span className="recipePill">{r.servings} servings</span>
                  )}
                </div>

                <div className="recipeActions">
                  <button className="recipeBtn" type="button" onClick={() => remove(rawId)}>
                    Remove
                  </button>
                  <Link className="recipeBtn recipeBtnPrimary" href={href}>
                    View
                  </Link>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
