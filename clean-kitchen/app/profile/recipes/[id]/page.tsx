"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Ingredient = { name: string; qty?: number; unit?: string };

export default function EditRecipePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rid = params?.id as string;

  const [authedUid, setAuthedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // fields
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [ingredients, setIngredients] = useState<string>("");
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setAuthedUid(u.uid);

      // load recipe
      const snap = await getDoc(doc(db, "recipes", rid));
      if (!snap.exists()) {
        setErr("Recipe not found.");
        setLoading(false);
        return;
      }
      const data = snap.data() as any;
      if (data.uid !== u.uid) {
        setErr("You can only edit your own recipe.");
        setLoading(false);
        return;
      }

      setTitle(data.title || "");
      setDesc(data.description || "");
      setSteps(data.steps || "");
      setImageURL(data.imageURL || null);
      // stringify ingredients back to textarea format
      const ing: Ingredient[] = Array.isArray(data.ingredients) ? data.ingredients : [];
      setIngredients(
        ing.map((i) => [i.name, i.qty ?? "", i.unit ?? ""].filter(Boolean).join(" | ")).join("\n")
      );
      setLoading(false);
    });
    return () => stop();
  }, [rid, router]);

  function parseIngredients(src: string): Ingredient[] {
    return src
      .split("\n").map((l) => l.trim()).filter(Boolean)
      .map((line) => {
        const [name, q, unit] = line.split("|").map((x) => x.trim());
        return { name, qty: q ? Number(q) : undefined, unit: unit || undefined };
      });
  }

  async function save() {
    if (!authedUid) return;
    if (!title.trim()) { setErr("Title is required."); return; }
    setErr(null); setMsg(null); setBusy(true);
    try {
      let newURL = imageURL;
      if (file) {
        const storageRef = ref(storage, `recipeImages/${authedUid}/${rid}`);
        await uploadBytes(storageRef, file);
        newURL = await getDownloadURL(storageRef);
      }
      await updateDoc(doc(db, "recipes", rid), {
        title: title.trim(),
        description: desc.trim() || null,
        steps: steps.trim() || null,
        ingredients: parseIngredients(ingredients),
        imageURL: newURL || null,
      });
      setImageURL(newURL || null);
      setFile(null);
      setMsg("Saved!");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="wrap">Loading…</main>;

  return (
    <main className="wrap">
      <h1 className="title">Edit Recipe</h1>

      {err && <p className="bad">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <Card className="section">
        <div className="grid">
          <Input label="Title" value={title} onChange={(e) => setTitle((e.target as HTMLInputElement).value)} />
          <Input label="Short description" value={desc} onChange={(e) => setDesc((e.target as HTMLInputElement).value)} />
        </div>

        <div className="field">
          <label className="label">Ingredients (one per line, Name | qty | unit)</label>
          <textarea
            className="ta" rows={6}
            value={ingredients}
            onChange={(e) => setIngredients((e.target as HTMLTextAreaElement).value)}
          />
        </div>

        <div className="field">
          <label className="label">Steps</label>
          <textarea
            className="ta" rows={6}
            value={steps}
            onChange={(e) => setSteps((e.target as HTMLTextAreaElement).value)}
          />
        </div>

        <div className="field">
          <label className="label">Image</label>
          {imageURL ? <img src={imageURL} alt="" style={{ width: 180, borderRadius: 12, border: "1px solid #e5e7eb", display: "block", marginBottom: 8 }} /> : null}
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <div className="actions">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </Card>

      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
        .section { margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
        @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
        .field { margin-bottom: 12px; }
        .label { display: block; margin-bottom: 6px; font-size: .9rem; color: #111827; font-weight: 500; }
        .ta {
          width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 10px 12px;
          font-size: 14px; transition: box-shadow .15s, border-color .15s; background: #fff;
        }
        .ta:focus { outline: none; border-color: #9ca3af; box-shadow: 0 0 0 4px rgba(17,24,39,.08); }
        .actions { display: flex; gap: 12px; justify-content: flex-end; }
        .ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
        .bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
      `}</style>
    </main>
  );
}
