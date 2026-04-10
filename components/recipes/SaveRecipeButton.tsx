"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";

type Props = {
  recipe: {
    id: number;
    title: string;
    image?: string | null;
    readyInMinutes?: number | null;
    servings?: number | null;
    sourceUrl?: string | null;
  };
  source?: "internal" | "external" | "themealdb";
  variant?: "primary" | "secondary";
};

export default function SaveRecipeButton({ recipe, source = "themealdb", variant = "primary" }: Props) {
  const { openLogin } = useAuthModal();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [isSaved, setIsSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) {
      setIsSaved(false);
      return;
    }
    const ref = doc(db, "users", uid, "savedFoods", String(recipe.id));
    return onSnapshot(ref, (snap) => setIsSaved(snap.exists()));
  }, [uid, recipe.id]);

  const cls = useMemo(
    () => (variant === "primary" ? "btn-base btn--primary btn--md" : "btn-base btn--secondary btn--md"),
    [variant]
  );

  const toggleSave = async () => {
    if (!uid) {
      openLogin("/recipes");
      return;
    }

    setBusy(true);
    try {
      const ref = doc(db, "users", uid, "savedFoods", String(recipe.id));
      if (isSaved) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          source,
          id: String(recipe.id),
          recipeId: recipe.id,
          title: recipe.title,
          imageURL: recipe.image ?? null,
          image: recipe.image ?? "",
          timeMinutes: recipe.readyInMinutes ?? null,
          readyInMinutes: recipe.readyInMinutes ?? null,
          servings: recipe.servings ?? null,
          sourceUrl: recipe.sourceUrl ?? null,
          savedAt: serverTimestamp(),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className={cls} type="button" onClick={toggleSave} disabled={busy} aria-disabled={!uid}>
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
