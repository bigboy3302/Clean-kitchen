"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type MealDBDetails = {
  source: "themealdb";
  id: string;
  title: string;
  imageURL: string | null;
  category: string | null;
  area: string | null;
  ingredients: { name: string; measure: string }[];
  instructions: string;
  sourceUrl: string | null;
  youtubeUrl: string | null;
};

function parseMealDbSteps(raw?: string | null): string[] {
  if (!raw) return [];
  const lines = String(raw)
    .replace(/\r/g, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const steps: string[] = [];
  let buf: string[] = [];

  const flush = () => {
    const joined = buf.join(" ").replace(/\s+/g, " ").trim();
    if (joined) steps.push(joined);
    buf = [];
  };

  for (const line of lines) {
    if (/^\d+$/.test(line)) {
      flush();
      continue;
    }
    if (/servings?/i.test(line) && line.length <= 24) continue;
    buf.push(line);
  }
  flush();
  return steps.length ? steps : [];
}

export default function ExternalRecipePage() {
  const { id } = useParams<{ id: string }>();

  const reqSeq = useRef(0);
  const [data, setData] = useState<MealDBDetails | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const mySeq = ++reqSeq.current;

    (async () => {
      setLoading(true);
      setErr(null);
      setData(null);

      try {
        const res = await fetch(`/api/recipes/${id}`, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as MealDBDetails;

        if (reqSeq.current !== mySeq) return;
        setData(json);
      } catch (e: any) {
        if (reqSeq.current !== mySeq) return;
        setErr(e?.message ?? "Failed to load recipe.");
      } finally {
        if (reqSeq.current !== mySeq) return;
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <main className="xp-container">
        <div className="xp-loading">
          <div className="xp-skel-hero" />
          <div className="xp-skel-grid">
            <div className="xp-skel-box" />
            <div className="xp-skel-box" />
          </div>
        </div>
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="xp-container">
        <div className="xp-error">
          <h3>Recipe not found</h3>
          <p className="muted">{err || "We couldn't locate the requested recipe."}</p>
          <Link className="btn primary" href="/recipes" style={{ marginTop: 12 }}>
            Back to recipes
          </Link>
        </div>
      </main>
    );
  }

  const steps = parseMealDbSteps(data.instructions);

  return (
    <main className="xp-container">
      <header className="xp-header">
        <Link className="xp-back-btn" href="/recipes">
          Back to recipes
        </Link>
        <span className="xp-badge">External Source</span>
      </header>

      <section className="xp-hero">
        <div className="xp-image-card">
          {data.imageURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageURL} alt={data.title} className="xp-img" />
          ) : (
            <div className="xp-img-ph">No Image Available</div>
          )}
        </div>

        <div className="xp-info-card">
          <h1 className="xp-title">{data.title}</h1>

          <div className="xp-tags">
            {data.category && <span className="xp-tag">{data.category}</span>}
            {data.area && <span className="xp-tag">{data.area}</span>}
          </div>

          <div className="xp-actions">
            {data.youtubeUrl && (
              <a className="xp-btn xp-btn-yt" href={data.youtubeUrl} target="_blank" rel="noreferrer">
                Watch Video
              </a>
            )}
            {data.sourceUrl && (
              <a className="xp-btn xp-btn-source" href={data.sourceUrl} target="_blank" rel="noreferrer">
                View Original
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="xp-grid">
        <aside className="xp-panel">
          <h3 className="xp-h3">Ingredients</h3>

          {data.ingredients?.length ? (
            <ul className="xp-ing-list">
              {data.ingredients.map((it, idx) => (
                <li key={idx} className="xp-ing-item">
                  <div className="xp-check" />
                  <span className="xp-ing-name">
                    {it.name}
                    {it.measure && <span className="xp-ing-measure">({it.measure})</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No ingredients listed.</p>
          )}
        </aside>

        <article className="xp-body">
          <h2 className="xp-h2">Instructions</h2>

          {steps.length ? (
            <div className="xp-steps">
              {steps.map((line, i) => (
                <div key={i} className="xp-step">
                  <div className="xp-step-num">{i + 1}</div>
                  <p className="xp-step-txt">{line}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No steps provided.</p>
          )}
        </article>
      </section>
    </main>
  );
}
