"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import dynamic from "next/dynamic";
const RecipePhotos = dynamic(() => import("components/recipes/RecipeImageUploader"), { ssr: false });

export default function RecipeDetailPage() {
  const { id } = useParams(); // ✅ available on /recipes/[id]
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => stop();
  }, []);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "recipes", String(id));
    const stop = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setRecipe(null);
          setErr("This recipe doesn’t exist (or was deleted).");
          return;
        }
        setRecipe({ id: snap.id, ...(snap.data() || {}) });
        setErr(null);
      },
      (e) => {
        setLoading(false);
        setErr(e?.message ?? "Could not load recipe.");
      }
    );
    return () => stop();
  }, [id]);

  function toDateSafe(ts) {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
    return null;
  }

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">Loading recipe…</div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (err) {
    return (
      <main className="wrap">
        <div className="card error">{err}</div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="wrap">
        <div className="card">Recipe not found.</div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  const created = toDateSafe(recipe.createdAt);
  const isOwner = me && recipe.uid === me.uid;

  // Prefer username/displayName saved on the recipe when created.
  const author = recipe.author || {};
  const authorName =
    author.username || author.displayName || recipe.uid?.slice(0, 6) || "Unknown";

  return (
    <main className="wrap">
      <article className="recipe">
        <header className="head">
          <h1 className="title">{recipe.title || "Untitled recipe"}</h1>
          <div className="meta">
            <div className="author">
              {author.avatarURL ? (
                <img className="avatar" src={author.avatarURL} alt="" />
              ) : (
                <div className="avatar fallback">
                  {(authorName?.[0] || "U").toUpperCase()}
                </div>
              )}
              <span>
                by <strong>{authorName}</strong>
                {created ? (
                  <> • {created.toLocaleDateString()}{" "}
                  {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                ) : null}
              </span>
            </div>
{/* Photo gallery (read-only for visitors) */}
<RecipePhotos recipeId={recipe.id} recipeUid={recipe.uid} canEdit={false} />

            <div className="actions">
              <Link className="btn" href="/recipes">All recipes</Link>
              {isOwner && (
                <Link className="btn primary" href={`/profile/recipes/${recipe.id}`}>
                  Edit
                </Link>
              )}
            </div>
          </div>
        </header>

        {recipe.imageURL && (
          <div className="imgWrap">
            <img className="img" src={recipe.imageURL} alt={recipe.title || ""} />
          </div>
        )}

        {recipe.description && (
          <section className="section">
            <h2 className="h2">Description</h2>
            <p className="text">{recipe.description}</p>
          </section>
        )}

        {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
          <section className="section">
            <h2 className="h2">Ingredients</h2>
            <ul className="ingredients">
              {recipe.ingredients.map((ing, i) => {
                const name = ing?.name || "Ingredient";
                const qty  = ing?.qty;
                const unit = ing?.unit;
                return (
                  <li key={i}>
                    <span className="dot" />
                    <span>
                      {name}{qty ? ` — ${qty}` : ""}{unit ? ` ${unit}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {recipe.steps && (
          <section className="section">
            <h2 className="h2">Steps</h2>
            <div className="steps">
              {String(recipe.steps).split("\n").map((line, i) => (
                <p key={i} className="stepLine">{line.trim()}</p>
              ))}
            </div>
          </section>
        )}
      </article>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
.wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
.card { border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:16px; }
.error { background:#fef2f2; color:#991b1b; border-color:#fecaca; }

.recipe { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 20px 50px rgba(2,6,23,.04); overflow:hidden; }
.head { padding:18px 18px 8px; border-bottom:1px solid #f1f5f9; }
.title { margin:0; font-size:28px; font-weight:800; color:#0f172a; }
.meta { margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.author { display:flex; align-items:center; gap:10px; color:#475569; }
.avatar { width:34px; height:34px; border-radius:999px; object-fit:cover; border:1px solid #e2e8f0; }
.avatar.fallback { width:34px; height:34px; border-radius:999px; display:grid; place-items:center; background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #e2e8f0; }
.actions { display:flex; gap:8px; }
.btn { border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:14px; color:#0f172a; text-decoration:none; background:#fff; }
.btn:hover { background:#f8fafc; }
.btn.primary { background:#0f172a; color:#fff; border-color:#0f172a; }
.btn.primary:hover { opacity:.95; }

.imgWrap { width:100%; max-height:520px; overflow:hidden; border-bottom:1px solid #f1f5f9; }
.img { width:100%; display:block; object-fit:cover; }

.section { padding:16px 18px; }
.h2 { font-size:18px; font-weight:700; color:#0f172a; margin:0 0 8px; }
.text { color:#334155; }

.ingredients { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
.ingredients li { display:flex; align-items:center; gap:8px; color:#0f172a; }
.dot { width:6px; height:6px; border-radius:999px; background:#0f172a; display:inline-block; }

.steps { display:grid; gap:8px; }
.stepLine { margin:0; color:#0f172a; }
`;
