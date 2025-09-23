// components/fitness/WorkoutGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise } from "@/lib/workouts/types";
import type { Goal } from "@/lib/fitness/calc";
import WorkoutModal from "./WorkoutModal";

type Props = {
  initialBodyPart?: string;
  title?: string;
  limit?: number;
  goal?: Goal;
};

const MIN_SEARCH_CHARS = 2;
const cache = new Map<string, Exercise[]>();

export default function WorkoutGrid({
  initialBodyPart = "chest",
  title = "Exercise GIFs",
  limit = 12,
  goal = "maintain",
}: Props) {
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [sel, setSel] = useState<string>(initialBodyPart);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [list, setList] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openEx, setOpenEx] = useState<Exercise | null>(null);

  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 500);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/workouts/bodyparts");
        const data = (await res.json()) as string[] | { error?: string };
        if (!alive) return;
        if (Array.isArray(data)) {
          setBodyParts(data);
          if (data.length && !data.includes(initialBodyPart)) setSel(data[0]);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [initialBodyPart]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setErr(null);

    const hasSearch = debouncedQ.length >= MIN_SEARCH_CHARS;
    const key = hasSearch
      ? `q:${debouncedQ.toLowerCase()}:limit=${limit}`
      : `part:${sel.toLowerCase()}:limit=${limit}`;

    lastKeyRef.current = key;

    if (cache.has(key)) {
      const cached = cache.get(key)!;
      if (alive && lastKeyRef.current === key) {
        setList(cached);
        setBusy(false);
      }
      return;
    }

    const endpoint = hasSearch
      ? `/api/workouts?q=${encodeURIComponent(debouncedQ)}&limit=${limit}`
      : `/api/workouts?bodyPart=${encodeURIComponent(sel)}&limit=${limit}`;

    (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();

        if (!alive || lastKeyRef.current !== key) return;

        if (Array.isArray(data)) {
          const cleaned = (data as Exercise[]).filter(x => x && x.name);
          cache.set(key, cleaned);
          setList(cleaned);
        } else {
          setErr(String(data?.error || "Failed to load."));
          setList([]);
        }
      } catch (e: any) {
        if (!alive || lastKeyRef.current !== key) return;
        setErr(e?.message || "Failed to load exercises.");
        setList([]);
      } finally {
        if (alive && lastKeyRef.current === key) setBusy(false);
      }
    })();

    return () => { alive = false; };
  }, [sel, debouncedQ, limit]);

  function onPick(part: string) {
    setQ("");
    setSel(part);
  }

  const heading = useMemo(() => {
    if (debouncedQ.length >= MIN_SEARCH_CHARS) return `Results for “${debouncedQ}”`;
    return `${cap(sel)} exercises`;
  }, [debouncedQ, sel]);

  // stream by ID (no key exposed)
  function imgById(id: string, res = 360) {
    return `/api/workouts/gif?id=${encodeURIComponent(id)}&res=${res}`;
  }

  return (
    <section className="card">
      <div className="head">
        <div>
          <h3 className="h3">{title}</h3>
          <div className="sub">{heading}</div>
        </div>
        <div className="search">
          <input
            className="inp"
            placeholder="Search exercise name (e.g., squat)"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </div>
      </div>

      {bodyParts.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Body parts">
          {bodyParts.map((p) => (
            <button
              key={p}
              className={`tab ${sel === p ? "on" : ""}`}
              onClick={() => onPick(p)}
              role="tab"
              aria-selected={sel === p}
            >
              {cap(p)}
            </button>
          ))}
        </div>
      )}

      {busy && <p className="muted">Loading…</p>}
      {err && <p className="error">{err}</p>}
      {!busy && !err && list.length === 0 && (
        <p className="muted">No exercises found. Try another search or body part.</p>
      )}

      <div className="grid">
        {list.map((ex) => (
          <article key={`${ex.id}-${ex.name}`} className="item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgById(ex.id)}
              alt={ex.name}
              className="gif"
              loading="lazy"
              onError={(e) => {
                console.warn("GIF failed by id:", ex.id);
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="meta">
              <div className="name">{cap(ex.name)}</div>
              <div className="row">
                <span className="chip">{cap(ex.bodyPart)}</span>
                <span className="chip">{cap(ex.target)}</span>
                <span className="chip">{cap(ex.equipment)}</span>
              </div>
              <div className="actions">
                <button className="open" onClick={() => setOpenEx(ex)}>Open</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {openEx ? (
        <WorkoutModal
          exercise={openEx}
          goal={goal}
          onClose={() => setOpenEx(null)}
        />
      ) : null}

      <p className="muted small" style={{ marginTop: 8 }}>
        
      </p>

      <style jsx>{`
        .card{border:1px solid #e5e7eb;background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.04)}
        .head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .h3{margin:0}
        .sub{color:#475569;font-size:13px;margin-top:2px}
        .search .inp{border:1px solid #d1d5db;border-radius:12px;padding:8px 10px;min-width:240px}
        .tabs{display:flex;gap:8px;overflow:auto;padding:8px 0}
        .tab{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer;white-space:nowrap}
        .tab.on{background:#0f172a;border-color:#0f172a;color:#fff}
        .muted{color:#64748b}
        .small{font-size:12px}
        .error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:13px}
        .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:10px}
        @media (max-width:1000px){ .grid{grid-template-columns:repeat(3,1fr);} }
        @media (max-width:720px){ .grid{grid-template-columns:repeat(2,1fr);} }
        @media (max-width:520px){ .grid{grid-template-columns:1fr;} }
        .item{border:1px solid #eef2f7;border-radius:12px;overflow:hidden;background:#fff;display:flex;flex-direction:column}
        .gif{width:100%;height:220px;object-fit:contain;background:#f8fafc}
        .meta{padding:8px;display:flex;flex-direction:column;gap:6px}
        .name{font-weight:800;color:#0f172a}
        .row{display:flex;gap:6px;flex-wrap:wrap}
        .chip{font-size:12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:2px 8px}
        .actions{display:flex;justify-content:flex-end;margin-top:4px}
        .open{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer}
      `}</style>
    </section>
  );
}

function cap(s: string) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
