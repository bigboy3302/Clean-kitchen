"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

type Recipe = {
  id: string;
  uid: string;
  title?: string | null;
  description?: string | null;
  imageURL?: string | null;
  createdAt?: any;
};

export default function RecipesListPage() {
  const [list, setList] = useState<Recipe[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(
      q,
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setErr(null);
      },
      (e) => setErr(e?.message ?? "Failed to load recipes.")
    );
    return () => stop();
  }, []);

  return (
    <main className="wrap">
      <h1 className="title">Recipes</h1>
      {err && <p className="bad">{err}</p>}
      {list.length === 0 ? (
        <p className="muted">No recipes yet.</p>
      ) : (
        <ul className="grid">
          {list.map((r) => (
            <li key={r.id} className="card">
              <Link href={`/recipes/${r.id}`} className="link">
                {r.imageURL ? <img className="thumb" src={r.imageURL} alt="" /> : <div className="thumb ph" />}
                <div className="meta">
                  <div className="title2">{r.title || "Untitled"}</div>
                  {r.description && <div className="desc">{r.description}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .wrap { max-width: 1000px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 800; margin-bottom: 12px; }
        .muted { color:#6b7280; }
        .bad { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; padding:8px 10px; border-radius:8px; }
        .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:16px; list-style:none; padding:0; margin:0; }
        .card { border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#fff; }
        .link { display:block; text-decoration:none; color:inherit; }
        .thumb { width:100%; height:160px; object-fit:cover; border-bottom:1px solid #eef2f7; }
        .thumb.ph { background:#f1f5f9; }
        .meta { padding:12px; }
        .title2 { font-weight:700; }
        .desc { color:#4b5563; font-size:14px; margin-top:4px; }
      `}</style>
    </main>
  );
}
