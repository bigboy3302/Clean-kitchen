"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { db } from "@/lib/firebas1e";
import { doc, onSnapshot, updateDoc, deleteDoc, type FirestoreError } from "firebase/firestore";
import { recipePageStyles } from "@/components/recipes/recipePageStyles";

type Ingredient = { name?: string; measure?: string | null; qty?: string; unit?: string };

type RecipeDoc = {
  id: string;
  uid?: string;
  title?: string | null;
  description?: string | null;
  imageURL?: string | null;
  image?: string | null;
  timeMinutes?: number | null;
  servings?: number | null;
  category?: string | null;
  area?: string | null;
  ingredients?: Ingredient[];
  instructions?: string | null;
  steps?: string | null;
};

function ingredientsToText(list?: Ingredient[]) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list
    .map((it) => {
      const name = (it?.name ?? "").trim();
      const measure =
        (it?.measure ?? "").trim() ||
        [it?.qty, it?.unit].filter(Boolean).join(" ").trim();
      if (!name) return "";
      return measure ? `${name} - ${measure}` : name;
    })
    .filter(Boolean)
    .join("\n");
}

function parseIngredients(text: string): Ingredient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, measure] = line.split("-").map((part) => part.trim());
      return { name, measure: measure || null };
    });
}

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [recipe, setRecipe] = useState<RecipeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeMinutes, setTimeMinutes] = useState<string>("");
  const [servings, setServings] = useState<string>("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");

  const [busy, setBusy] = useState(false);
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
          setLoadErr("This recipe doesn't exist (or was deleted).");
          return;
        }
        const data = (snap.data() || {}) as Omit<RecipeDoc, "id">;
        const next: RecipeDoc = { id: snap.id, ...data };
        setRecipe(next);
        setLoadErr(null);

        setTitle(next.title ?? "");
        setDescription(next.description ?? "");
        setTimeMinutes(next.timeMinutes != null ? String(next.timeMinutes) : "");
        setServings(next.servings != null ? String(next.servings) : "");
        setCategory(next.category ?? "");
        setArea(next.area ?? "");
        setImageURL((next.imageURL ?? next.image ?? "") || "");
        setIngredientsText(ingredientsToText(next.ingredients));
        setStepsText((next.instructions ?? next.steps ?? "") || "");
      },
      (error: FirestoreError) => {
        setLoading(false);
        setLoadErr(error.message || "Could not load recipe.");
      }
    );

    return () => stop();
  }, [id]);

  const cover = useMemo(() => imageURL.trim() || null, [imageURL]);

  const validate = () => {
    if (!title.trim()) return "Title is required.";
    if (!timeMinutes.trim() || Number(timeMinutes) <= 0) return "Time (minutes) is required.";
    if (!servings.trim() || Number(servings) <= 0) return "Servings is required.";
    if (!category.trim()) return "Category is required.";
    if (!area.trim()) return "Area is required.";
    return null;
  };

  const onSave = async () => {
    const message = validate();
    if (message) {
      setErr(message);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const ref = doc(db, "recipes", String(id));
      await updateDoc(ref, {
        title: title.trim(),
        description: description.trim() || null,
        timeMinutes: Number(timeMinutes),
        servings: Number(servings),
        category: category.trim(),
        area: area.trim(),
        imageURL: imageURL.trim() || null,
        ingredients: parseIngredients(ingredientsText),
        instructions: stepsText.trim() || null,
      });

      router.push(`/recipes/${id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save changes.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this recipe? This cannot be undone.")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteDoc(doc(db, "recipes", String(id)));
      router.push("/recipes");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete recipe.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">Loading...</div>
        <style jsx>{recipePageStyles}</style>
      </main>
    );
  }

  if (loadErr || !recipe) {
    return (
      <main className="wrap">
        <div className="card bad">{loadErr || "Recipe not found."}</div>
        <Link className="btn ghost" href="/recipes">
          Back to recipes
        </Link>
        <style jsx>{recipePageStyles}</style>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="strip">
        <Link className="btn ghost" href={`/recipes/${id}`}>
          Back to recipe
        </Link>
        <div className="actions">
          <span className="hint">Edit recipe</span>
        </div>
      </header>

      {err ? <div className="card bad">{err}</div> : null}

      <section className="hero">
        <div className="cover">
          {cover ? (
            <Image
              src={cover}
              alt={title || "Recipe cover"}
              fill
              className="coverImg"
              sizes="(min-width: 900px) 55vw, 100vw"
            />
          ) : (
            <div className="ph" aria-hidden>
              <span className="muted">Paste an image URL to preview</span>
            </div>
          )}
        </div>

        <div className="head">
          <h1 className="title">Edit recipe</h1>

          <div className="stack">
            <div>
              <label>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            </div>

            <div>
              <label>Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </div>

            <div className="grid-2">
              <div>
                <label>Time (minutes) *</label>
                <input
                  type="number"
                  min={1}
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.currentTarget.value)}
                />
              </div>
              <div>
                <label>Servings *</label>
                <input
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(e.currentTarget.value)}
                />
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label>Category *</label>
                <input value={category} onChange={(e) => setCategory(e.currentTarget.value)} />
              </div>
              <div>
                <label>Area *</label>
                <input value={area} onChange={(e) => setArea(e.currentTarget.value)} />
              </div>
            </div>

            <div>
              <label>Cover image URL</label>
              <input
                value={imageURL}
                onChange={(e) => setImageURL(e.currentTarget.value)}
                placeholder="https://..."
              />
            </div>

            <div className="spaced">
              <button className="btn primary" type="button" onClick={onSave} disabled={busy}>
                {busy ? "Saving..." : "Save changes"}
              </button>
              <button className="btn" type="button" onClick={onDelete} disabled={busy}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid">
        <aside className="panel">
          <div className="panelHead">
            <span className="dot" /> Ingredients
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            One per line. Optional: use "-" for quantity (example: "Chicken - 200g").
          </p>
          <textarea
            rows={12}
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.currentTarget.value)}
          />
        </aside>

        <article className="body">
          <h2 className="h2">Steps</h2>
          <textarea
            rows={16}
            value={stepsText}
            onChange={(e) => setStepsText(e.currentTarget.value)}
          />
        </article>
      </section>

      <style jsx>{recipePageStyles}</style>
    </main>
  );
}
