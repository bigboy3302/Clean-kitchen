"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebas1e";
import { doc, onSnapshot, type FirestoreError, type Timestamp } from "firebase/firestore";
import DisableBackgroundMotion from "@/components/background/DisableBackgroundMotion";

type Author = {
  uid?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
} | null;

type Ingredient = { name?: string; measure?: string | null; qty?: string; unit?: string };

type TimestampLike =
  | Timestamp
  | { seconds?: number; toDate?: () => Date }
  | Date
  | number
  | string
  | null
  | undefined;

type RecipeDoc = {
  id: string;
  uid?: string;
  title?: string | null;
  description?: string | null;
  timeMinutes?: number | null;
  servings?: number | null;
  image?: string | null;
  imageURL?: string | null;
  gallery?: { id: string; url: string }[];
  category?: string | null;
  area?: string | null;
  ingredients?: Ingredient[];
  steps?: string | null;
  instructions?: string | null;
  author?: Author;
  createdAt?: TimestampLike;
};

function toMillis(ts: TimestampLike): number {
  try {
    if (!ts) return 0;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") {
      const parsed = Date.parse(ts);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof ts === "object") {
      if (typeof ts?.toDate === "function") return ts.toDate().getTime();
      if (typeof ts?.seconds === "number") return ts.seconds * 1000;
    }
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

  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const ref = doc(db, "recipes", String(id));
    const stop = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setRecipe(null);
          setErr("This recipe doesn't exist (or was deleted).");
          return;
        }
        const data = (snap.data() || {}) as Omit<RecipeDoc, "id">;
        setRecipe({ id: snap.id, ...data });
        setErr(null);
      },
      (error: FirestoreError) => {
        setLoading(false);
        setErr(error.message || "Could not load recipe.");
      }
    );

    return () => stop();
  }, [id]);

  const created = useMemo(() => (recipe ? new Date(toMillis(recipe.createdAt)) : null), [recipe]);
  const title = recipe?.title || "Untitled recipe";
  const cover = recipe?.imageURL || recipe?.image || null;
  const desc = recipe?.description || "";
  const steps = toLines(recipe?.instructions || recipe?.steps);
  const ing: Ingredient[] = Array.isArray(recipe?.ingredients) ? recipe?.ingredients ?? [] : [];
  const authorName =
    recipe?.author?.displayName ||
    recipe?.author?.username ||
    (recipe?.uid ? recipe.uid.slice(0, 6) : "Unknown");

  if (loading) {
    return (
      <main className="container section">
        <div className="card">Loading recipe…</div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="container section">
        <div className="card alert-error">{err}</div>
        <Link className="btn-base btn--secondary btn--md" href="/recipes" style={{ marginTop: 12 }}>
          Back to recipes
        </Link>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="container section">
        <div className="card">Recipe not found.</div>
        <Link className="btn-base btn--secondary btn--md" href="/recipes" style={{ marginTop: 12 }}>
          Back to recipes
        </Link>
      </main>
    );
  }

  return (
    <main className="container section recipePublic">
      <DisableBackgroundMotion />
      <header className="recipePublicBar">
        <Link className="btn-base btn--secondary btn--sm" href="/recipes">
          Back to recipes
        </Link>
        <div className="recipePublicBarActions">
          <span className="recipePublicHint">You’re viewing a public recipe</span>
          <Link className="btn-base btn--secondary btn--sm" href={`/recipes/edit/${id}`}>
            Edit
          </Link>
        </div>
      </header>

      <section className="recipePublicHero">
        <div className="recipePublicCover card">
          {cover ? (
            <Image
              src={cover}
              alt={title}
              fill
              className="recipePublicCoverImg"
              sizes="(min-width: 900px) 55vw, 100vw"
            />
          ) : (
            <div className="recipePublicCoverPh" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path
                  d="M4 5h16v14H4z M8 11a2 2 0 114 0 2 2 0 01-4 0zm10 6l-4.5-6-3.5 4.5L8 13l-4 4h14z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="card recipePublicHead">
          <h1 className="recipePublicTitle">{title}</h1>

          <div className="recipePublicMeta">
            <div className="recipePublicWho">
              {recipe?.author?.avatarURL ? (
                <Image
                  className="recipePublicAvatarImg"
                  src={recipe.author.avatarURL}
                  alt=""
                  width={44}
                  height={44}
                />
              ) : (
                <div className="recipePublicAvatarPh">{authorName[0]?.toUpperCase() || "U"}</div>
              )}

              <div className="recipePublicNames">
                <div className="recipePublicName">{authorName}</div>
                {created ? (
                  <div className="recipePublicTime">
                    {created.toLocaleDateString()} {" "}
                    {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="recipePublicChips">
              {recipe?.timeMinutes ? (
                <span className="recipePill">{recipe.timeMinutes} min</span>
              ) : null}
              {recipe?.servings ? (
                <span className="recipePill">{recipe.servings} servings</span>
              ) : null}
              {recipe?.category ? <span className="recipePill">{recipe.category}</span> : null}
              {recipe?.area ? <span className="recipePill">{recipe.area}</span> : null}
            </div>
          </div>

          {desc ? <p className="muted" style={{ margin: 0 }}>{desc}</p> : null}
        </div>
      </section>

      <section className="recipePublicGrid">
        <aside className="card recipePublicPanel">
          <div className="recipePublicPanelHead">
            <span className="recipePublicDot" /> Ingredients
          </div>

          {ing.length === 0 ? (
            <p className="muted">No ingredients listed.</p>
          ) : (
            <ul className="recipePublicIngList">
              {ing.map((it, idx) => {
                const name = it?.name || "Ingredient";
                const measure = it?.measure ?? [it?.qty, it?.unit].filter(Boolean).join(" ");
                return (
                  <li key={idx} className="recipePublicIng">
                    <span className="recipePublicBullet" />
                    <span className="recipePublicIngName">{name}</span>
                    {measure ? <span className="recipePublicIngQty">{measure}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <article className="card recipePublicBody">
          <h2 className="recipePublicH2">Steps</h2>

          {steps.length === 0 ? (
            <p className="muted">No steps provided.</p>
          ) : (
            <ol className="recipePublicStepList">
              {steps.map((line, i) => (
                <li key={i} className="recipePublicStep">
                  <span className="recipePublicNum">{i + 1}</span>
                  <p className="recipePublicStepTxt">{line}</p>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </main>
  );
}
