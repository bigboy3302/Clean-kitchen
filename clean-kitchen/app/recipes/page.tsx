"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Card from "@/components/ui/Card";

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<any | null>(null);

  useEffect(() => {
    async function run() {
      const snap = await getDoc(doc(db, "recipes", id));
      setR(snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null);
    }
    run();
  }, [id]);

  if (!r) return null;

  const ts = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : null;

  return (
    <main className="wrap">
      <Card className="card">
        <h1 className="title">{r.title || "Untitled"}</h1>
        {r.imageURL ? <img className="img" src={r.imageURL} alt="" /> : null}
        {r.description ? <p className="desc">{r.description}</p> : null}

        {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
          <>
            <h3 className="h3">Ingredients</h3>
            <ul className="list">
              {r.ingredients.map((ing: any, i: number) => (
                <li key={i}>
                  <strong>{ing.name}</strong>
                  {ing.qty ? ` – ${ing.qty}` : ""}{ing.unit ? ` ${ing.unit}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}

        {r.steps ? (
          <>
            <h3 className="h3">Steps</h3>
            <pre className="steps">{r.steps}</pre>
          </>
        ) : null}

        <div className="meta">{ts ? ts.toLocaleString() : ""}</div>
      </Card>

      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
        .card { display:grid; gap:12px; }
        .title { font-size: 26px; font-weight: 800; }
        .img { width:100%; border-radius:12px; border:1px solid #e5e7eb; }
        .desc { color:#475569; }
        .h3 { margin-top:8px; font-weight:700; }
        .list { margin:0; padding-left:18px; }
        .steps { white-space:pre-wrap; background:#fafafa; border:1px solid #e5e7eb; padding:10px; border-radius:10px; }
        .meta { color:#64748b; font-size:12px; }
      `}</style>
    </main>
  );
}
