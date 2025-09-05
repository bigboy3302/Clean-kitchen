"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type Ingredient = { name: string; qty?: number; unit?: string };
type Recipe = {
  id: string;
  uid: string;
  title: string;
  description?: string | null;
  steps?: string | null;
  imageURL?: string | null;
  ingredients: Ingredient[];
  createdAt?: any;
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [servings, setServings] = useState<number>(1);

  useEffect(() => {
    const qy = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
      setRecipes(rows);
    });
    return () => stop();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recipes;
    return recipes.filter(r =>
      (r.title?.toLowerCase().includes(s)) ||
      (r.description?.toLowerCase().includes(s)) ||
      (r.ingredients || []).some(i => i.name.toLowerCase().includes(s))
    );
  }, [q, recipes]);

  function scaleQty(qty?: number) {
    if (!qty || Number.isNaN(qty)) return null;
    const scaled = qty * Math.max(1, servings);
    // show integers nicely, decimals to 2 dp
    return Math.abs(scaled - Math.round(scaled)) < 1e-9 ? String(Math.round(scaled)) : scaled.toFixed(2);
  }

  return (
    <main className="wrap">
      <h1 className="title">Recipes</h1>

      <div className="toolbar">
        <div className="search">
          <Input
            placeholder="Search recipes or ingredients…"
            value={q}
            onChange={(e) => setQ((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="servings">
          <label className="label">Servings</label>
          <input
            type="number"
            min={1}
            className="num"
            value={servings}
            onChange={(e) => setServings(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))}
          />
        </div>
      </div>

      <div className="grid">
        {filtered.map((r) => (
          <Card key={r.id}>
            <div className="card">
              {r.imageURL && <img className="thumb" src={r.imageURL} alt="" />}
              <div className="body">
                <h3 className="h3">{r.title}</h3>
                {r.description && <p className="desc">{r.description}</p>}

                {!!(r.ingredients?.length) && (
                  <div className="ing">
                    <div className="ingTitle">Ingredients (×{servings})</div>
                    <ul className="ul">
                      {r.ingredients.map((ing, idx) => (
                        <li key={idx}>
                          <span className="ingName">{ing.name}</span>
                          {ing.qty != null && (
                            <> — <b>{scaleQty(ing.qty)}</b>{ing.unit ? ` ${ing.unit}` : ""}</>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.steps && (
                  <div className="steps">
                    <div className="ingTitle">Steps</div>
                    <pre className="pre">{r.steps}</pre>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <style jsx>{`
        .wrap { max-width: 1000px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }

        .toolbar { display: flex; gap: 16px; align-items: end; margin-bottom: 16px; }
        .search { flex: 1; }
        .servings { width: 140px; }
        .label { display: block; margin-bottom: 6px; font-size: .9rem; color: #111827; font-weight: 500; }
        .num { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 8px 10px; font-size: 14px; }

        .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .card { display: grid; grid-template-columns: 180px 1fr; gap: 14px; align-items: start; }
        @media (max-width: 700px) { .card { grid-template-columns: 1fr; } }

        .thumb { width: 100%; border-radius: 12px; border: 1px solid #e5e7eb; object-fit: cover; height: 140px; }
        .h3 { font-size: 18px; font-weight: 700; margin: 4px 0 6px; }
        .desc { color: #374151; font-size: 14px; margin-bottom: 6px; }

        .ing { margin-top: 6px; }
        .ingTitle { font-weight: 600; margin-bottom: 6px; }
        .ul { margin: 0; padding-left: 16px; }
        .ingName { color: #111827; }

        .steps { margin-top: 10px; }
        .pre {
          margin: 0; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px;
          padding: 10px; white-space: pre-wrap; font-size: 13px; color: #111827;
        }
      `}</style>
    </main>
  );
}
