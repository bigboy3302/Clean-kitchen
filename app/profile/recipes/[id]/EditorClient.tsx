"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebas1e";
import { doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";
import BookWritingLoader from "./BookWritingLoader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type RecipeDoc = {
  id: string;
  uid: string;
  title?: string | null;
  image?: string | null;
  imageURL?: string | null;
  category?: string | null;
  area?: string | null;
  ingredients?: { name?: string; measure?: string | null }[];
  instructions?: string | null;
  author?: { uid?: string | null; name?: string | null } | null;
  timeMinutes?: number | null;
  servings?: number | null;
};

function ingredientsToText(ingredients?: { name?: string; measure?: string | null }[]) {
  if (!Array.isArray(ingredients)) return "";
  return ingredients
    .map((item) => {
      const name = item?.name?.trim() || "";
      const measure = item?.measure?.trim() || "";
      if (!name) return "";
      return measure ? `${name} - ${measure}` : name;
    })
    .filter(Boolean)
    .join("\n");
}

function splitIngredientLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return { name: "", measure: "" };
  const parts = trimmed.split(/\s[-–—]\s/);
  if (parts.length > 1) {
    return { name: parts[0].trim(), measure: parts.slice(1).join(" - ").trim() };
  }
  return { name: trimmed, measure: "" };
}

export default function EditorClient({ initial }: { initial: RecipeDoc }) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setMe(u || null);
      setAuthReady(true);
    });
    return () => stop();
  }, []);

  const [ownerUid] = useState<string | null>(initial?.uid || null);
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [area, setArea] = useState(initial?.area || "");
  const [cover, setCover] = useState<string | null>(initial?.image || initial?.imageURL || null);
  const [minutes, setMinutes] = useState(
    String(initial?.timeMinutes ?? (initial as { minutes?: number | null }).minutes ?? "")
  );
  const [servings, setServings] = useState(String(initial?.servings ?? ""));
  const [ingredientsText, setIngredientsText] = useState(ingredientsToText(initial?.ingredients));
  const [stepsText, setStepsText] = useState((initial?.instructions || "").trim());

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const isOwner = useMemo(() => !!me && !!ownerUid && me.uid === ownerUid, [me, ownerUid]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = fileInputRef.current;
    const file = e.currentTarget.files?.[0];
    if (!file || !me?.uid || !id) {
      if (inputEl) inputEl.value = "";
      return;
    }
    setSaving(true);
    try {
      const path = `recipeImages/${me.uid}/${id}/cover`;
      const storageRef = sref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "recipes", String(id)), { image: url, updatedAt: serverTimestamp() });
      setCover(url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to upload cover.";
      setErr(message);
    } finally {
      setSaving(false);
      if (inputEl) inputEl.value = "";
    }
  }

  async function onRemoveCover() {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "recipes", String(id)), { image: null, updatedAt: serverTimestamp() });
      setCover(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to remove cover.";
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!id) return;
    if (!isOwner) {
      setErr("You can only edit your own recipe.");
      return;
    }
    if (!title.trim()) {
      setErr("Please enter a title.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const ingredients = ingredientsText
        .split("\n")
        .map((line) => splitIngredientLine(line))
        .filter((item) => item.name)
        .map((item) => ({ name: item.name, measure: item.measure || "" }));

      const minutesValue = minutes.trim();
      const servingsValue = servings.trim();
      const minutesNum = minutesValue ? Number(minutesValue) : null;
      const servingsNum = servingsValue ? Number(servingsValue) : null;

      await updateDoc(doc(db, "recipes", String(id)), {
        title: title.trim(),
        titleLower: title.trim().toLowerCase(),
        category: category.trim() || null,
        area: area.trim() || null,
        ingredients,
        instructions: stepsText.trim() || null,
        timeMinutes: Number.isFinite(minutesNum) ? minutesNum : null,
        servings: Number.isFinite(servingsNum) ? servingsNum : null,
        updatedAt: serverTimestamp(),
      });

      router.push("/recipes");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save.";
      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!id || !isOwner) return;
    setDeleteErr(null);
    setConfirmOpen(true);
  }

  async function doDelete() {
    if (!id || !isOwner || deleting) return;
    setDeleteErr(null);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "recipes", String(id)));
      setConfirmOpen(false);
      router.push("/recipes");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete.";
      setDeleteErr(message);
    } finally {
      setDeleting(false);
    }
  }

  if (!authReady) {
    return <BookWritingLoader variant="flip" />;
  }

  if (!isOwner) {
    return (
      <main className="container section">
        <div className="card">
          <p>You don’t have permission to edit this recipe.</p>
          <Link className="btn-base btn--secondary btn--md" href={`/recipes/${id}`}>
            View recipe
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container section">
      <div className="card">
        <div className="spaced">
          <h1 style={{ margin: 0 }}>Edit Recipe</h1>
          <Link className="btn-base btn--secondary btn--sm" href="/recipes">
            Cancel
          </Link>
        </div>

        <div className="recipeForm" style={{ marginTop: 12 }}>
          <div>
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          </div>

          <div className="formRow2">
            <div>
              <label>Time (minutes)</label>
              <input
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.currentTarget.value)}
              />
            </div>
            <div>
              <label>Servings</label>
              <input
                type="number"
                min={0}
                value={servings}
                onChange={(e) => setServings(e.currentTarget.value)}
              />
            </div>
          </div>

          <div className="formRow2">
            <div>
              <label>Category</label>
              <input value={category} onChange={(e) => setCategory(e.currentTarget.value)} />
            </div>
            <div>
              <label>Area</label>
              <input value={area} onChange={(e) => setArea(e.currentTarget.value)} />
            </div>
          </div>

          <div>
            <label>Cover image</label>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={title || "cover"}
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              />
            ) : (
              <div className="card">No cover image yet.</div>
            )}
            <div className="formActions">
              <label className="btn-base btn--secondary btn--sm">
                Change cover
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickCover}
                  hidden
                />
              </label>
              {cover ? (
                <button
                  className="btn-base btn--ghost btn--sm"
                  type="button"
                  onClick={onRemoveCover}
                  disabled={saving}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label>Ingredients</label>
            <textarea
              rows={6}
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.currentTarget.value)}
            />
            <div className="help">One per line works best.</div>
          </div>

          <div>
            <label>Steps</label>
            <textarea
              rows={8}
              value={stepsText}
              onChange={(e) => setStepsText(e.currentTarget.value)}
            />
          </div>

          {err && <div className="alert-error">{err}</div>}
          {deleteErr && <div className="alert-error">{deleteErr}</div>}

          <div className="formActions">
            <button
              className="btn-base btn--secondary btn--md"
              type="button"
              onClick={remove}
              disabled={saving || deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              className="btn-base btn--primary btn--md"
              type="button"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this recipe?"
        message={`“${title || "Untitled"}” will be permanently removed.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        onConfirm={doDelete}
        onCancel={() => (deleting ? null : setConfirmOpen(false))}
        zIndex={2400}
      />
    </main>
  );
}
