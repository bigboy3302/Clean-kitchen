// app/recipes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Card from "@/components/ui/Card";
import SearchBar from "@/components/ui/SearchBar";

type Recipe = {
  id: string;
  name: string;
  nameLower?: string;
  description?: string;
  tags?: string[];
  imageUrl?: string;
};

export default function RecipesPage() {
  const [all, setAll] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [qText, setQText] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const qRef = query(collection(db, "recipes"), orderBy("name"));
      const snap = await getDocs(qRef);
      setAll(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = qText.trim().toLowerCase();
    if (!q) return all;
    return all.filter(r =>
      (r.nameLower ?? r.name.toLowerCase()).includes(q) ||
      (r.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  }, [qText, all]);

  return (
    <div className="container">
      <h1>Recipes</h1>
      <p>Discover ideas. Search by name, ingredient, or tag.</p>

      <Card>
        <SearchBar value={qText} onChange={setQText} />
      </Card>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {loading ? (
          <Card>Loading…</Card>
        ) : filtered.length === 0 ? (
          <Card>No recipes found.</Card>
        ) : (
          filtered.map(r => (
            <Card key={r.id}>
              {r.imageUrl && (
                <img
                  src={r.imageUrl}
                  alt={r.name}
                  style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10, marginBottom: 10 }}
                />
              )}
              <h2>{r.name}</h2>
              {r.description && <p style={{ marginTop: 6 }}>{r.description}</p>}
              {!!r.tags?.length && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.tags.map(t => <span key={t} className="badge">#{t}</span>)}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
