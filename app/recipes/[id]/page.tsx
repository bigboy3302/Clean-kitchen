// app/recipes/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

type Author = {
  uid?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
} | null;

type Ingredient = { name?: string; measure?: string | null; qty?: string; unit?: string };

type RecipeDoc = {
  id: string;
  uid?: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  imageURL?: string | null;
  gallery?: { id: string; url: string }[];
  category?: string | null;
  area?: string | null;
  ingredients?: Ingredient[];
  steps?: string | null;
  instructions?: string | null;
  author?: Author;
  createdAt?: any;
};

function toMillis(ts: any): number {
  try {
    if (!ts) return 0;
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  } catch {}
  return 0;
}
function toLines(txt?: string | null): string[] {
  if (!txt) return [];
  return String(txt)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}


export default function RecipePublicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [ready, setReady] = useState(false);

  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setMe(u || null);
      setReady(true);
    });
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
        const data = (snap.data() || {}) as any;
        setRecipe({ id: snap.id, ...data });
        setErr(null);
      },
      (e) => {
        setLoading(false);
        setErr(e?.message ?? "Could not load recipe.");
      }
    );
    return () => stop();
  }, [id]);

  const isOwner = useMemo(
    () => !!me && !!recipe?.uid && me.uid === recipe.uid,
    [me, recipe?.uid]
  );

  const created = useMemo(() => (recipe ? new Date(toMillis(recipe.createdAt)) : null), [recipe?.createdAt]);
  const title = recipe?.title || "Untitled recipe";
  const cover = recipe?.imageURL || recipe?.image || null;
  const gallery = Array.isArray(recipe?.gallery) ? recipe!.gallery : [];
  const desc = recipe?.description || "";
  const steps = toLines(recipe?.instructions || recipe?.steps);
  const ing = Array.isArray(recipe?.ingredients) ? recipe!.ingredients : [];
  const authorName =
    recipe?.author?.displayName ||
    recipe?.author?.username ||
    (recipe?.uid ? recipe.uid.slice(0, 6) : "Unknown");

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
        <div className="card bad">{err}</div>
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

  return (
    <main className="wrap">
     
      <header className="strip">
        <Link className="btn ghost" href="/recipes">← All recipes</Link>
        <div className="actions">
            <span className="hint">You’re viewing a public recipe</span>
        </div>
      </header>

      <section className="hero">
        <div className="cover">
          {cover ? (
           
            <img src={cover} alt={title} />
          ) : (
            <div className="ph" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path d="M4 5h16v14H4z M8 11a2 2 0 114 0 2 2 0 01-4 0zm10 6l-4.5-6-3.5 4.5L8 13l-4 4h14z" fill="currentColor"/>
              </svg>
            </div>
          )}
        </div>

        <div className="head">
          <h1 className="title">{title}</h1>
          <div className="meta">
            <div className="who">
              {recipe?.author?.avatarURL ? (
              
                <img className="avatar" src={recipe.author.avatarURL} alt="" />
              ) : (
                <div className="avatar ph">{authorName[0]?.toUpperCase() || "U"}</div>
              )}
              <div className="names">
                <div className="name">{authorName}</div>
                {created ? (
                  <div className="time">
                    {created.toLocaleDateString()}{" "}
                    {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="chips">
              {recipe?.category ? <span className="chip">{recipe.category}</span> : null}
              {recipe?.area ? <span className="chip">{recipe.area}</span> : null}
            </div>
          </div>

          {desc ? <p className="desc">{desc}</p> : null}
        </div>
      </section>

   
      <section className="grid">
        <aside className="panel">
          <div className="panelHead"><span className="dot" /> Ingredients</div>
          {ing.length === 0 ? (
            <p className="muted">No ingredients listed.</p>
          ) : (
            <ul className="ingList">
              {ing.map((it, idx) => {
                const name = it?.name || "Ingredient";
                
                const measure =
                  it?.measure ??
                  [it?.qty, it?.unit].filter(Boolean).join(" ");
                return (
                  <li key={idx} className="ing">
                    <span className="bullet" />
                    <span className="itName">{name}</span>
                    {measure ? <span className="itQty">{measure}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <article className="body">
          <section className="steps">
            <h2 className="h2">Steps</h2>
            {steps.length === 0 ? (
              <p className="muted">No steps provided.</p>
            ) : (
              <ol className="stepList">
                {steps.map((line, i) => (
                  <li key={i} className="step">
                    <span className="num">{i + 1}</span>
                    <p className="txt">{line}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </article>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
.wrap{ max-width: 1100px; margin: 0 auto; padding: 14px; color: var(--text); }
.card{ border:1px solid var(--border); background: var(--card-bg); border-radius: 14px; padding: 12px; }
.bad{ background: color-mix(in oklab, #ef4444 12%, var(--card-bg)); color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%); border-color: color-mix(in oklab, #ef4444 35%, var(--border)); }

.strip{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
.btn{ border:1px solid var(--border); background: var(--bg2); color: var(--text); border-radius:12px; padding:8px 12px; text-decoration:none; font-weight:800; }
.btn:hover{ background: color-mix(in oklab, var(--bg2) 90%, var(--bg)); }
.btn.primary{ background: var(--primary); color: var(--primary-contrast); border-color: color-mix(in oklab, var(--primary) 40%, var(--border)); }
.btn.ghost{ background: transparent; }
.hint{ color: var(--muted); font-size: 13px; }

.hero{ display:grid; gap:14px; grid-template-columns: 1.4fr 1fr; align-items: stretch; }
@media (max-width: 900px){ .hero{ grid-template-columns: 1fr; } }

.cover{ border:1px solid var(--border); background:#000; border-radius:16px; overflow:hidden; aspect-ratio: 16/10; }
.cover img{ width:100%; height:100%; object-fit:cover; display:block; }
.cover .ph{ width:100%; height:100%; display:grid; place-items:center; color: var(--muted); background: var(--bg2); }

.head{
  border:1px solid var(--border);
  background: var(--card-bg);
  border-radius:16px;
  padding:14px;
  box-shadow: 0 10px 30px rgba(0,0,0,.06);
  display:grid; gap:8px;
}
.title{ margin:0; font-size: clamp(22px, 3.4vw, 30px); font-weight:900; letter-spacing:-.02em; }
.meta{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.who{ display:flex; align-items:center; gap:10px; }
.avatar{ width:44px; height:44px; border-radius:999px; object-fit:cover; border:1px solid var(--border); }
.avatar.ph{ width:44px; height:44px; border-radius:999px; display:grid; place-items:center; background:var(--bg2); color:var(--text); font-weight:900; }
.names{ line-height:1.1 }
.name{ font-weight:800 }
.time{ font-size:12px; color: var(--muted) }
.chips{ display:flex; gap:8px; flex-wrap:wrap }
.chip{ font-size:12px; font-weight:800; padding: 4px 10px; border-radius:999px; background: color-mix(in oklab, var(--primary) 12%, var(--bg)); border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border)); }
.desc{ margin: 6px 0 0; color: var(--text) }

.grid{ display:grid; gap:14px; grid-template-columns: 340px 1fr; align-items:start; margin-top:14px; }
@media (max-width: 1024px){ .grid{ grid-template-columns: 1fr; } }

.panel{
  position: sticky; top: 14px;
  border:1px solid var(--border); background: var(--card-bg);
  border-radius:16px; padding:12px; box-shadow: 0 10px 30px rgba(0,0,0,.06);
}
.panelHead{ display:flex; align-items:center; gap:8px; font-weight:900; margin-bottom:8px; letter-spacing:-.01em; }
.dot{ width:10px; height:10px; border-radius:999px; background: var(--primary); box-shadow: 0 0 12px color-mix(in oklab, var(--primary) 60%, transparent); }

.ingList{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.ing{ display:grid; grid-template-columns: auto 1fr auto; gap:8px; align-items:center; }
.bullet{ width:6px; height:6px; border-radius:999px; background: var(--text); }
.itName{ font-weight:600; color: var(--text) }
.itQty{ color: var(--muted); font-size: 13px; }

.body{
  border:1px solid var(--border); background: var(--card-bg);
  border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,.06);
  padding: 12px;
}
.h2{ margin:0 0 8px; font-size:18px; font-weight:900; letter-spacing:-.01em; }

.stepList{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
.step{ display:grid; grid-template-columns: 28px 1fr; gap:10px; align-items:start; }
.num{
  width:28px; height:28px; border-radius:10px; border:1px solid var(--border);
  display:grid; place-items:center; font-weight:800; background: var(--bg2);
}
.txt{ margin:0; color: var(--text); }

.gGrid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap:10px;
}
.gItem{
  border:1px solid var(--border); border-radius:12px; overflow:hidden; background:#000; aspect-ratio: 4/3;
}
.gItem img{ width:100%; height:100%; object-fit:cover; display:block; }

.muted{ color: var(--muted) }
`;