// app/recipes/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/button";

export default function NewRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) router.replace("/auth/login");
  }, [router]);

  function parseIngredients(text: string) {
    // allow "1 cup sugar" or "sugar - 1 cup"
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((l) => {
      const parts = l.split(" - ");
      if (parts.length === 2) return { name: parts[0], measure: parts[1] };
      return { name: l, measure: "" };
    });
  }

  async function submit() {
    setErr(null);
    const u = auth.currentUser;
    if (!u) { router.replace("/auth/login"); return; }
    if (!title.trim()) { setErr("Please enter a title."); return; }

    setBusy(true);
    try {
      const ingredients = parseIngredients(ingredientsText);
      await addDoc(collection(db, "recipes"), {
        uid: u.uid,
        author: {
          uid: u.uid,
          name: u.displayName || null,
          avatarURL: u.photoURL || null,
        },
        title: title.trim(),
        titleLower: title.trim().toLowerCase(),
        imageURL: image.trim() || null,
        ingredients,
        instructions: instructions.trim() || null,
        createdAt: serverTimestamp(),
      });
      router.push("/recipes");
    } catch (e: any) {
      setErr(e?.message || "Failed to create recipe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <h1 className="pageTitle">Add a Recipe</h1>

      <section className="card">
        <div className="grid">
          <Input label="Title" value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Best Tomato Pasta" />
          <Input label="Image URL (optional)" value={image} onChange={(e:any)=>setImage(e.target.value)} placeholder="https://…" />
        </div>

        <div className="field">
          <label className="label">Ingredients (one per line)</label>
          <textarea className="ta" rows={8} value={ingredientsText} onChange={(e)=>setIngredientsText(e.target.value)} placeholder="pasta - 250 g&#10;tomato - 2 pcs&#10;garlic - 2 cloves" />
        </div>

        <div className="field">
          <label className="label">Instructions</label>
          <textarea className="ta" rows={8} value={instructions} onChange={(e)=>setInstructions(e.target.value)} placeholder="Write the steps here…" />
        </div>

        {err && <p className="error">{err}</p>}
        <div className="actions">
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create recipe"}</Button>
          <Button variant="secondary" onClick={()=>router.push("/recipes")} disabled={busy}>Cancel</Button>
        </div>
      </section>

      <style jsx>{`
        .container { max-width: 900px; margin: 0 auto; padding: 24px; }
        .pageTitle { font-size: 28px; font-weight: 800; margin-bottom: 16px; }
        .card { border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:16px; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px 16px; }
        @media (max-width: 860px){ .grid{ grid-template-columns: 1fr; } }
        .field { margin-top:12px; }
        .label { display:block; margin-bottom:6px; font-weight:600; }
        .ta { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; font-size:14px; background:#fff; }
        .actions { margin-top:12px; display:flex; gap:10px; justify-content:flex-end; }
        .error { margin-top:10px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; }
      `}</style>
    </main>
  );
}
