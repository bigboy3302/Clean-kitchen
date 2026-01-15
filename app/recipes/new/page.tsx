"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";

type Ingredient = { name: string; measure?: string };

export default function NewRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) router.replace("/auth/login");
  }, [router]);

  const parseIngredients = (): Ingredient[] => {
    return ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, measure] = line.split("-").map((part) => part.trim());
        return { name, measure: measure || "" };
      });
  };

  const validate = () => {
    if (!auth.currentUser) return "You must be signed in.";
    if (!title.trim()) return "Title is required.";
    if (!timeMinutes.trim() || Number(timeMinutes) <= 0) return "Time (minutes) is required.";
    if (!servings.trim() || Number(servings) <= 0) return "Servings is required.";
    if (!category.trim()) return "Category is required.";
    if (!area.trim()) return "Area is required.";
    return null;
  };

  const createRecipe = async (event: FormEvent) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      setErr(error);
      return;
    }

    const u = auth.currentUser;
    if (!u) {
      router.replace("/auth/login");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      await addDoc(collection(db, "recipes"), {
        uid: u.uid,
        author: {
          uid: u.uid,
          name: u.displayName || null,
          avatarURL: u.photoURL || null,
        },
        title: title.trim(),
        titleLower: title.trim().toLowerCase(),
        description: description.trim(),
        timeMinutes: Number(timeMinutes),
        servings: Number(servings),
        category: category.trim(),
        area: area.trim(),
        imageURL: imageURL.trim() || null,
        ingredients: parseIngredients(),
        instructions: stepsText.trim(),
        createdAt: serverTimestamp(),
      });
      router.push("/recipes");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create recipe.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container section recipePublic">
      <header className="recipePublicBar">
        <Link className="btn-base btn--secondary btn--sm" href="/recipes">
          Back to recipes
        </Link>
        <span className="recipePublicHint">Create a new recipe</span>
      </header>

      {err ? (
        <div className="card alert-error" role="alert">
          {err}
        </div>
      ) : null}

      <form onSubmit={createRecipe}>
        <section className="recipePublicHero">
          <div className="recipePublicCover card">
            {imageURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="recipePublicCoverImg" src={imageURL} alt="" />
            ) : (
              <div className="recipePublicCoverPh" aria-hidden>
                <span className="muted">Paste an image URL to preview</span>
              </div>
            )}
          </div>

          <div className="card recipePublicHead">
            <h1 className="recipePublicTitle">New recipe</h1>

            <div className="recipeForm">
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

              <div className="formRow2">
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

              <div className="formRow2">
                <div>
                  <label>Category *</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.currentTarget.value)}
                    placeholder="e.g., Dinner"
                  />
                </div>
                <div>
                  <label>Area *</label>
                  <input
                    value={area}
                    onChange={(e) => setArea(e.currentTarget.value)}
                    placeholder="e.g., Italian"
                  />
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

              <div className="formActions">
                <button className="btn-base btn--primary btn--md" type="submit" disabled={busy}>
                  {busy ? "Creating..." : "Create recipe"}
                </button>
                <Link className="btn-base btn--secondary btn--md" href="/recipes">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="recipePublicGrid">
          <aside className="card recipePublicPanel">
            <div className="recipePublicPanelHead">
              <span className="recipePublicDot" /> Ingredients
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              One per line. Use "-" for quantity (example: "Chicken - 200g").
            </p>
            <textarea
              rows={10}
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.currentTarget.value)}
              placeholder={"Chicken - 200g\nRice - 1 cup\nTomato"}
            />
          </aside>

          <article className="card recipePublicBody">
            <h2 className="recipePublicH2">Steps</h2>
            <textarea
              rows={14}
              value={stepsText}
              onChange={(e) => setStepsText(e.currentTarget.value)}
              placeholder={"1. Prep ingredients...\n2. Cook...\n3. Serve..."}
            />
          </article>
        </section>
      </form>
    </main>
  );
}
